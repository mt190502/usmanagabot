import { Client, Events } from 'discord.js';
import timers from 'timers/promises';
import { RESTCommandLoader } from '../commands/loader';
import { BotClient, BotConfiguration, DatabaseConnection } from '../main';
import { BotData } from '../types/database/bot';
import { Guilds } from '../types/database/guilds';
import { Logger } from './logger';

export const InitialSetup = async () => {
    while (!DatabaseConnection.isInitialized) await timers.setTimeout(1000);

    const guilds = await DatabaseConnection.manager.find(Guilds);
    if (guilds.length === 0) {
        Logger('info', 'Initial setup is required. Setting up guilds...');

        BotClient.once(Events.ClientReady, async (client: Client) => {
            Logger('info', `Logged in as ${client.user.tag}`);
            try {
                for (const guild of client.guilds.cache) {
                    const new_guild = new Guilds();
                    new_guild.name = guild[1].name;
                    new_guild.gid = BigInt(guild[0]);
                    new_guild.country = client.guilds.cache.get(guild[0]).preferredLocale;
                    await DatabaseConnection.manager.save(new_guild);
                }
            } catch (error) {
                Logger('error', `Failed to save guilds to database: ${error}`);
                process.exit(1);
            }
        });

        BotClient.login(BotConfiguration.token);
        while (!BotClient.isReady()) await timers.setTimeout(1000);

        if (!BotClient.guilds.cache.size) {
            Logger(
                'error',
                'Failed to get guilds from client, please add the bot to a server first or check the token. Exiting...'
            );
            process.exit(1);
        }

        const last_command_refresh_date = new BotData();
        last_command_refresh_date.key = 'last_command_refresh_date';
        await DatabaseConnection.manager.save(last_command_refresh_date);

        await RESTCommandLoader();

        Logger('warn', 'Initial setup completed, please restart the bot to apply changes...');
        process.exit(0);
    } else {
        Logger('info', 'Founded guilds in database, skipping first run setup...');
        return;
    }
};
