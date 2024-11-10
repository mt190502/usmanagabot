import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { DataSource } from 'typeorm';
import { CommandLoaderAfterBotReady, RESTCommandLoader } from './commands/loader';
import { EventLoader } from './events/loader';
import { Command_t } from './types/interface/commands';
import { BotConfiguration_t } from './types/interface/config';
import { DatabaseConfiguration_t } from './types/interface/database';
import { Event_t } from './types/interface/events';
import { ConfigLoader } from './utils/config';
import { DatabaseLoader } from './utils/database';
import { InitialSetup } from './utils/setup';

export const BotConfiguration: BotConfiguration_t = ConfigLoader('../config', 'bot.yml');
export const DatabaseConfiguration: DatabaseConfiguration_t = ConfigLoader('../config', 'database.yml');
export let DatabaseConnection: DataSource;

export const BotCommands: Collection<bigint, Collection<string, Command_t>> = new Collection();
export const LoadAfterBotReady: Collection<bigint, string[]> = new Collection();
export const BotEvents: Collection<string, Event_t> = new Collection();

export const BotClient = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User],
});

(async () => {
    DatabaseConnection = await DatabaseLoader(DatabaseConfiguration);
    await InitialSetup();
    await RESTCommandLoader();
    await EventLoader();
    BotClient.login(BotConfiguration.token);
    await CommandLoaderAfterBotReady();
})();
