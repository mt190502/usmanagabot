import { Collection, REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
import { globSync } from 'glob';
import path from 'path';
import timers from 'timers/promises';
import { BotCommands, BotConfiguration, DatabaseConnection } from '../main';
import { Command_t } from '../types/interface/commands';
import { Logger } from '../utils/logger';

const rest = new REST({ version: '10' });
const restCMDs: Collection<number, Collection<string, RESTPostAPIChatInputApplicationCommandsJSONBody>> = new Collection();

const loadCommandFromFile = async (filePath: string): Promise<Command_t | null> => {
    const filename = filePath.match(/([^/]+\/[^/]+)$/)[1];
    const cmdModule = await import(filePath);
    const cmd: Command_t = cmdModule.default;

    if (!cmd.name || !cmd.enabled) {
        Logger('warn', `Command \"${filename}\" does not have a name or is disabled, skipping...`);
        return null;
    }

    Logger('info', `Loading command \"${cmd.name}\" from \"commands/${filename}\"`);
    return cmd;
}

export const RegisterCommands = async () => {
    if (!BotCommands.has(0)) BotCommands.set(0, new Collection());
    for (const file of globSync(path.join(__dirname, './**/*.ts'), { ignore: '**/loader.ts' })) {
        const cmd = await loadCommandFromFile(file);
        if (cmd) {
            BotCommands.get(0).set(cmd.name, cmd);
            Logger('info', `Successfully registered command: \"${cmd.name}\"`);
        }
    } 
    // add custom commands
}

export const RESTCommandLoader = async () => {
    rest.setToken(BotConfiguration.token);
    while (!DatabaseConnection.isConnected) await timers.setTimeout(1000);

    for (const file of globSync(path.join(__dirname, './**/*.ts'), { ignore: '**/loader.ts' })) {
        const cmd = await loadCommandFromFile(file);
        if (!restCMDs.has(0)) restCMDs.set(0, new Collection());
        if (cmd && cmd.type == 'standard') restCMDs.get(0).set(cmd.name, (await cmd.data()).toJSON());
    }

    try {
        await rest.put(Routes.applicationCommands(BotConfiguration.app_id), { body: [] });
        Logger('info', 'Successfully cleared global commands.');
        await rest.put(Routes.applicationCommands(BotConfiguration.app_id), { body: restCMDs.get(0).toJSON() });
        Logger('info', `Successfully reloaded global commands.`);
    } catch (error) {
        Logger('error', error);
    }
}
