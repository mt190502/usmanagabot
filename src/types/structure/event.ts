import { Awaitable, ClientEvents } from 'discord.js';
import { Config } from '../../services/config';
import { Database } from '../../services/database';
import { Logger } from '../../services/logger';
import { DatabaseManager } from './database';

/**
 * An abstract class representing a base event handler.
 * All event handlers should extend this class.
 * @template {keyof ClientEvents} T - The name of the Discord.js client event this handler is for.
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
     * The main execution logic for the event handler.
     * @public
     * @abstract
     * @param {...ClientEvents[T]} args - The arguments emitted by the event.
     * @returns {Awaitable<void> | Promise<Awaitable<void>>}
     */
    public abstract execute(...args: ClientEvents[T]): Awaitable<void> | Promise<Awaitable<void>>;

    /**
     * Constructs a new instance of the BaseEvent.
     * @param {Omit<BaseEvent<T>, 'once' | 'execute'> & { once?: boolean }} options - The options to initialize the event handler with.
     */
    constructor(options: Omit<BaseEvent<T>, 'once' | 'execute'> & { once?: boolean }) {
        this.enabled = options.enabled;
        this.once = options.once;
        this.type = options.type;
    }
    // ================================================================ //

    // =================== EVENT UTILITIES SECTION ==================== //
    /**
     * Provides access to the bot's configuration.
     * @protected
     * @returns {Config} The configuration instance.
     */
    protected get cfg(): Config {
        return Config.getInstance();
    }

    /**
     * Provides access to the logger instance.
     * @protected
     * @returns {Logger} The logger instance.
     */
    protected get log(): Logger {
        return Logger.getInstance();
    }

    /**
     * Provides a promise that resolves to the database entity manager.
     * @protected
     * @returns {Promise<EntityManager>} A promise that resolves to the entity manager.
     */
    protected get db(): DatabaseManager {
        return Database.dbManager;
    }
    // ================================================================ //
}
