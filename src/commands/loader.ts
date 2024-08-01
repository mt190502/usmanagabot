import { Collection, REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from "discord.js";
import { globSync } from "glob";
import path from "path";
import { BotCommands, BotConfiguration, DatabaseConnection } from "../main";
import { BotData } from "../types/database/bot";
import { Guilds } from "../types/database/guilds";
import { Command_t } from "../types/interface/commands";
import { Logger } from "../utils/logger";

const rest = new REST({ version: '10' });
const restCMDs: Collection<string, Collection<string, RESTPostAPIChatInputApplicationCommandsJSONBody>> = new Collection();

export const CommandLoader = async () => {
    const guilds = await DatabaseConnection.manager.find(Guilds);
    for (const file of globSync(path.join(__dirname, './**/*.ts'), { ignore: '**/loader.ts' })) { 
        const cmd: Command_t = (await import(file)).default;
        const filename =  file.match(/([^/]+\/[^/]+)$/)[1];
        
        if (!cmd.name || !cmd.enabled) Logger('warn', `Command \"${filename}\" does not have a name or is disabled, skipping...`);
        Logger('info', `Loading command \"${cmd.name}\" from file \"commands/${filename}\"...`);

        if (cmd.type === 'customizable') {
            for (const guild of guilds) {
                if (!BotCommands.has(Number(guild.gid))) BotCommands.set(Number(guild.gid), new Collection());
                if (!restCMDs.has(guild.gid)) restCMDs.set(guild.gid, new Collection());
                if (JSON.parse(guild.disabled_commands).includes(cmd.name)) continue;
                BotCommands.get(Number(guild.gid)).set(cmd.name, cmd);
                restCMDs.get(guild.gid).set(cmd.name, (await cmd.data(guild)).toJSON());
            }
        } else {
            if (!BotCommands.has(0)) BotCommands.set(0, new Collection());
            if (!restCMDs.has('0')) restCMDs.set('0', new Collection());
            BotCommands.get(0).set(cmd.name, cmd);
            restCMDs.get('0').set(cmd.name, (await cmd.data()).toJSON());
        }
    }
}

export const RESTCommandLoader = async (custom_guild?: number) => {
    await CommandLoader();
    rest.setToken(BotConfiguration.token);
    for (const [guild, commands] of restCMDs) {
        if (custom_guild && custom_guild != Number(guild)) continue;
        try {
            if (guild === '0') {
                if (BotConfiguration.clear_old_commands) {
                    await rest.put(Routes.applicationCommands(BotConfiguration.app_id), { body: [] });
                    Logger('info', 'Successfully cleared global commands.');
                }
                await rest.put(Routes.applicationCommands(BotConfiguration.app_id), { body: commands.toJSON() });
                Logger('info', `Successfully reloaded global commands.`);
            } else {
                if (BotConfiguration.clear_old_commands || JSON.parse((await DatabaseConnection.manager.findOne(Guilds, { where: { gid: guild } }))?.disabled_commands).length > 0) {
                    await rest.put(Routes.applicationGuildCommands(BotConfiguration.app_id, guild), { body: [] });
                    Logger('info', `Successfully cleared commands for guild: ${guild}.`);
                }
                await rest.put(Routes.applicationGuildCommands(BotConfiguration.app_id, guild), { body: commands.toJSON() });
                Logger('info', `Successfully reloaded commands for guild: ${guild}.`);
            }
        } catch (error) {
            Logger('error', error);
        }
    }
    const last_command_refresh_date = await DatabaseConnection.manager.findOne(BotData, { where: { key: 'last_command_refresh_date' } });
    last_command_refresh_date.value = new Date().toISOString();
    await DatabaseConnection.manager.save(last_command_refresh_date);
}