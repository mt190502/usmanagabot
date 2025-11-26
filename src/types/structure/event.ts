import { Awaitable, BaseInteraction, ClientEvents } from 'discord.js';
import { Config } from '../../services/config';
import { Database } from '../../services/database';
import { Logger } from '../../services/logger';
import { Translator } from '../../services/translator';
import { DatabaseManager } from './database';

/**
 * The abstract base class for all Discord.js event handlers.
 *
 * It provides a common structure for event properties (`enabled`, `once`, `type`)
 * and provides utility getters for accessing static services like `Config`, `Logger`, and `Database`.
 *
 * All new event handlers should extend this class.
 * @template {keyof ClientEvents} T The name of the `discord.js` client event.
 */
export abstract class BaseEvent<T extends keyof ClientEvents> {
    // ======================== HEADER SECTION ======================== //
    /**
     * Specifies whether this event handler is enabled.
     * @public
     * @readonly
     * @type {boolean}
     * @default true
     */
    public readonly enabled: boolean = true;

    /**
     * If true, the event will be handled only once.
     * @public
     * @readonly
     * @type {boolean}
     * @default false
     */
    public readonly once?: boolean = false;

    /**
     * The type of the client event this handler is for.
     * @public
     * @readonly
     * @type {T}
     */
    public readonly type: T;
    // ================================================================ //

    // ====================== EVENT BASE SECTION ====================== //
    /**
     * The main execution logic for the event handler. This must be implemented by all subclasses.
     * @public
     * @abstract
     * @param {...ClientEvents[T]} args The arguments emitted by the `discord.js` client for the event.
     * @returns {Awaitable<void>}
     */
    public abstract execute(...args: ClientEvents[T]): Awaitable<void> | Promise<Awaitable<void>>;

    /**
     * Initializes a new instance of the `BaseEvent`.
     * @param {Omit<BaseEvent<T>, 'execute'>} options The options for the event handler.
     */
    constructor(options: Omit<BaseEvent<T>, 'once' | 'execute'> & { once?: boolean }) {
        this.enabled = options.enabled;
        this.once = options.once;
        this.type = options.type;
    }
    // ================================================================ //

    // =================== EVENT UTILITIES SECTION ==================== //
    /**
     * Provides access to the static `Config` class.
     * @protected
     * @returns {typeof Config} The `Config` class.
     */
    protected get cfg(): typeof Config {
        return Config;
    }

    /**
     * Provides access to the static `Logger` class.
     * @protected
     * @returns {typeof Logger} The `Logger` class.
     */
    protected get log(): typeof Logger {
        return Logger;
    }

    /**
     * Provides access to the `DatabaseManager` proxy.
     * @protected
     * @returns {DatabaseManager} The `DatabaseManager` instance.
     */
    protected get db(): DatabaseManager {
        return Database.dbManager;
    }

    /**
     * A convenience method for translating strings using the `Translator` service.
     *
     * This method automatically scopes the translation query to the 'commands' category.
     *
     * @protected
     * @param {string} key The localization key.
     * @param {Record<string, unknown>} [replacements] Optional placeholder values.
     * @param {BaseInteraction} [interaction] The interaction to derive the guild ID from.
     * @returns {string} The translated string.
     */
    protected t(key: string, replacements?: Record<string, unknown>, interaction?: BaseInteraction): string {
        return Translator.querySync('commands', key, replacements, BigInt(interaction!.guildId!));
    }
    // ================================================================ //
}
