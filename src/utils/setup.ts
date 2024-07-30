import { Client, Events, Guild } from "discord.js";
import timers from 'timers/promises';
import { RESTCommandLoader } from "../commands/loader";
import { BotClient, BotConfiguration, DatabaseConnection } from "../main";
import { Guilds } from "../types/database/guilds";
import { Logger } from "./logger";

export const InitialSetup = async () => {
    while (!DatabaseConnection.isInitialized) await timers.setTimeout(1000);

    const guilds = await DatabaseConnection.manager.find(Guilds)
    if (guilds.length === 0) {
        Logger('info', 'Initial setup is required. Setting up guilds...');
        
        BotClient.once(Events.ClientReady, async (client: Client) => {
            Logger('info', `Logged in as ${client.user.tag}`);
            try {
                for (const guild of client.guilds.cache) {
                    const newGuild = new Guilds();
                    newGuild.name = (guild[1] as Guild).name;
                    newGuild.gid = guild[0];
                    await DatabaseConnection.manager.save(newGuild);
                }
            } catch (error) {
                Logger('error', `Failed to save guilds to database: ${error}`);
                process.exit(1);
            }
        });

        BotClient.login(BotConfiguration.token);
        while (!BotClient.isReady()) await timers.setTimeout(1000);
        
        await RESTCommandLoader();
        
        Logger('warn', 'Initial setup completed, please restart the bot to apply changes...');
        process.exit(0);
    } else {
        Logger('info', 'Founded guilds in database, skipping first run setup...');
        return;
    }
}