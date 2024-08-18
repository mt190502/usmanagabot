import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
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
                if (!BotCommands.has(BigInt(guild.gid.toString()))) BotCommands.set(BigInt(guild.gid.toString()), new Collection());
                if (!restCMDs.has(guild.gid.toString())) restCMDs.set(guild.gid.toString(), new Collection());
                BotCommands.get(BigInt(guild.gid.toString())).set(cmd.name, cmd);
                if (cmd.category != 'pseudo') restCMDs.get(guild.gid.toString()).set(cmd.name, (await cmd.data(guild)).toJSON());
            }
        } else {
            if (!BotCommands.has(BigInt(0))) BotCommands.set(BigInt(0), new Collection());
            if (!restCMDs.has('0')) restCMDs.set('0', new Collection());
            BotCommands.get(BigInt(0)).set(cmd.name, cmd);
            if (cmd.category != 'pseudo') restCMDs.get('0').set(cmd.name, (await cmd.data()).toJSON());
        }
    }
}

export const RESTCommandLoader = async (custom_guild?: BigInt) => {
    await CommandLoader();
    rest.setToken(BotConfiguration.token);
    for (const [guild, commands] of restCMDs) {
        if (custom_guild && custom_guild != BigInt(guild)) continue;
        try {
            if (guild === '0') {
                if (BotConfiguration.clear_old_commands) {
                    await rest.put(Routes.applicationCommands(BotConfiguration.app_id), { body: [] });
                    Logger('info', 'Successfully cleared global commands.');
                }
                await rest.put(Routes.applicationCommands(BotConfiguration.app_id), { body: commands.toJSON() });
                Logger('info', `Successfully reloaded global commands.`);
            } else {
                if (BotConfiguration.clear_old_commands) {
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

    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.tz.setDefault(BotConfiguration.timezone)
    const last_command_refresh_date = await DatabaseConnection.manager.findOne(BotData, { where: { key: 'last_command_refresh_date' } });
    last_command_refresh_date.value = dayjs().format('YYYY-MM-DDTHH:mm:ssZ');
    await DatabaseConnection.manager.save(last_command_refresh_date);
}