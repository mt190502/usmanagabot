import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { DataSource } from "typeorm";
import { EventLoader } from "./events/loader";
import { Commands_t } from "./types/interface/commands";
import { BotConfiguration_t } from "./types/interface/config";
import { DatabaseConfiguration_t } from "./types/interface/database";
import { Events_t } from "./types/interface/events";
import { ConfigLoader } from "./utils/config";
import { DatabaseLoader } from "./utils/database";

export const BotConfiguration: BotConfiguration_t = ConfigLoader('../config', 'bot.yml');
export const DatabaseConfiguration: DatabaseConfiguration_t = ConfigLoader('../config', 'database.yml');
export const DatabaseConnection: DataSource = DatabaseLoader(DatabaseConfiguration);

export const BotCommands: Collection<string, Commands_t> = new Collection();
export const BotEvents: Collection<string, Events_t> = new Collection();

export const BotClient = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.Guilds,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User],
});

(async () => {
    await EventLoader();
    BotClient.login(BotConfiguration.token);
})();