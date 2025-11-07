import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { CommandLoader } from '@commands/index';
import { EventLoader } from '@events/index';
import { BotConfig_t } from '@services/config';
import { Logger } from '@services/logger';

/**
 * BotClient is the main entry point for initializing and managing the Discord bot client.
 *
 * Responsibilities:
 * - Instantiates the Discord.js Client with appropriate intents and partials.
 * - Chains command loading and event registration to configure the bot instance.
 * - Exposes access to the singleton bot client for use across the codebase.
 *
 * Usage:
 * - Call BotClient.init(token) once during startup to create a Client and log in.
 * - Retrieve the current bot client via BotClient.client or BotClient.getInstance().
 */
export class BotClient {
    /**
     * Singleton reference to the BotClient instance. Lazily instantiated via `getInstance`.
     */
    private static instance: BotClient | null = null;

    /**
     * Shared `Logger` singleton for structured logging and localization-backed messages.
     * @static
     * @type {Logger}
     */
    private static logger: Logger = Logger.getInstance();

    /**
     * The global `discord.js` Client instance representing the bot connection.
     * @static
     * @type {Client}
     */
    public static client: Client;

    /**
     * Initializes the bot client, configures events/commands, and logs in via the provided token.
     *
     * @static
     * @async
     * @param {BotConfig_t['token']} token Discord bot authentication token.
     * @returns {Promise<void>}
     */
    public static async init(token: BotConfig_t['token']): Promise<void> {
        const intents = [
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.DirectMessageTyping,
            GatewayIntentBits.DirectMessageReactions,
            GatewayIntentBits.GuildExpressions,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.MessageContent,
        ];
        const partials = [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User];
        const client = new Client({ intents, partials });
        BotClient.client = await EventLoader.init(client);
        await CommandLoader.init();
        BotClient.client.login(token);
    }

    /**
     * Gets the singleton instance of BotClient.
     * @returns {BotClient} The current BotClient instance.
     */
    public static getInstance(): BotClient {
        if (!BotClient.instance) {
            BotClient.instance = new BotClient();
        }
        return BotClient.instance;
    }
}
