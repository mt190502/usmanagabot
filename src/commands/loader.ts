import { Collection, REST, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { globSync } from 'glob';
import path from 'path';
import timers from 'timers/promises';
import { DatabaseConnection } from '../main';
import { Guilds } from '../types/database/guilds';
import { Commands_t } from '../types/interface/commands';
import { Logger } from '../utils/logger';

const rest = new REST({ version: '10' });
const restCMDs: Collection<number, Collection<string, RESTPostAPIChatInputApplicationCommandsJSONBody>> = new Collection();

export const CommandLoader = async (command?: Commands_t) => {
    while (DatabaseConnection.isInitialized == false) {
        Logger('warn', 'Database connection not established yet, waiting 1 second...');
        await timers.setTimeout(1000);
    }

    const guilds = await DatabaseConnection.manager.find(Guilds);
    if (guilds.length === 0) {
        Logger('warn', 'No guilds found in database, skipping custom command loading...');
    } else {
        guilds.forEach((guild) => {
            if (!restCMDs.has(guild.guildID)) restCMDs.set(guild.guildID, new Collection());
        });
    }

    if (!command) {
        for (const file of globSync(path.join(__dirname, './**/*.ts'), { ignore: '**/loader.ts' })) {
            const fileNameWithPath = file.match(/([^/]+\/[^/]+)$/)[0];
            const command = await import(`./${fileNameWithPath}`);
        }
    }
}