import { Collection, REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from "discord.js";
import { globSync } from "glob";
import path from "path";
import { BotCommands, BotConfiguration, DatabaseConnection } from "../main";
import { BotData } from "../types/database/bot";
import { Guilds } from "../types/database/guilds";
import { Command_t } from "../types/interface/commands";
import { Logger } from "../utils/logger";

const rest = new REST({ version: '10' });
const restCMDs: Collection<number, Collection<string, RESTPostAPIChatInputApplicationCommandsJSONBody>> = new Collection();

export const CommandLoader = async () => {
    const guilds = await DatabaseConnection.manager.find(Guilds);
    for (const file of globSync(path.join(__dirname, './**/*.ts'), { ignore: '**/loader.ts' })) { 
        const cmd: Command_t = (await import(file)).default;
        const filename =  file.match(/([^/]+\/[^/]+)$/)[1];
        
        if (!cmd.name || !cmd.enabled) Logger('warn', `Command \"${filename}\" does not have a name or is disabled, skipping...`);
        Logger('info', `Loading command \"${cmd.name}\" from file \"${filename}\"...`);

        if (cmd.type === 'customizable') {
            for (const guild of guilds) {
                if (!BotCommands.has(guild.id)) BotCommands.set(guild.id, new Collection());
                if (!restCMDs.has(guild.id)) restCMDs.set(guild.id, new Collection());
                BotCommands.get(guild.id).set(cmd.name, cmd);
                restCMDs.get(guild.id).set(cmd.name, (await cmd.data(guild)).toJSON()); // TODO: get data from database
            }
        } else {
            if (!BotCommands.has(0)) BotCommands.set(0, new Collection());
            if (!restCMDs.has(0)) restCMDs.set(0, new Collection());
            BotCommands.get(0).set(cmd.name, cmd);
            restCMDs.get(0).set(cmd.name, (await cmd.data()).toJSON());
        }
    }
}

export const RESTCommandLoader = async () => {
    await CommandLoader();
    for (const [guild, commands] of restCMDs) {
        try {
            if (guild === 0) {
                await rest.put(Routes.applicationCommands(BotConfiguration.app_id), { body: [] });
                Logger('info', 'Successfully cleared global commands.');
                await rest.put(Routes.applicationCommands(BotConfiguration.app_id), { body: commands.toJSON() });
                Logger('info', `Successfully reloaded global commands.`);
            } else {
                await rest.put(Routes.applicationGuildCommands(BotConfiguration.app_id, <string><unknown>guild), { body: [] });
                Logger('info', `Successfully cleared commands for guild: ${guild}.`);
                await rest.put(Routes.applicationGuildCommands(BotConfiguration.app_id, <string><unknown>guild), { body: commands.toJSON() });
                Logger('info', `Successfully reloaded commands for guild: ${guild}.`);
            }
        } catch (error) {
            Logger('error', error);
        }
    }
    const last_command_refresh_date = await DatabaseConnection.manager.find(BotData, { where: { key: 'last_command_refresh_date' } });
    last_command_refresh_date[0].value = new Date().toISOString();
    await DatabaseConnection.manager.save(last_command_refresh_date);
}