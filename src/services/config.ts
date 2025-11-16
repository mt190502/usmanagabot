import botcfg from '@config/bot.jsonc';
import dbcfg from '@config/database.jsonc';
import { Logger, LogLevels, SupportedLanguages } from '@services/logger';
import fs from 'fs';
import { z } from 'zod';

/**
 * Configuration module.
 * Provides zod schemas and a singleton Config class that loads and validates
 * bot and database configuration from the repository defaults or provided overrides.
 */

/**
 * Zod schema for the bot configuration.
 *
 * Validated properties:
 * - app_id: Discord application ID (string, required)
 * - clear_old_commands_on_startup: whether to clear commands on startup (boolean)
 * - language: localization language (enum of SupportedLanguages)
 * - log_level: minimum log level (enum of LogLevels)
 * - management: nested object with management feature flags and IDs
 * - token: bot token used for login (string, required)
 */
const bot_config_schema = z.object({
    app_id: z.string().min(1, 'Application ID cannot be empty'),
    clear_old_commands_on_startup: z.boolean().default(false),
    language: z
        .enum(SupportedLanguages, {
            message: 'Invalid language',
        })
        .default(SupportedLanguages.EN),
    log_level: z
        .enum(LogLevels, {
            message: 'Invalid log level',
        })
        .default(process.env.NODE_ENV === 'production' ? LogLevels.error : LogLevels.debug),
    management: z.object({
        enabled: z.boolean().default(false),
        main_guild_id: z.string().optional(),
        channel_id: z.string().optional(),
    }),
    token: z.string().min(1, 'Bot token cannot be empty'),
});
export type BotConfig_t = z.infer<typeof bot_config_schema>;

/**
 * Zod schema for the database configuration.
 *
 * Validated properties:
 * - host: database host (string)
 * - port: database port (number)
 * - username: database user (string)
 * - password: database password (string|undefined)
 * - database: database name (string)
 * - synchronize: whether to synchronize schema (boolean)
 * - logging: enable TypeORM logging (boolean)
 */
const database_config_schema = z.object({
    host: z.string().min(1, 'Database host cannot be empty').default('localhost'),
    port: z.number().int().positive('Database port must be a positive integer').default(5432),
    username: z.string().min(1, 'Database username cannot be empty').default('usmanagabot'),
    password: z.string().optional(),
    database: z.string().min(1, 'Database name cannot be empty').default('usmanagabot'),
    synchronize: z.boolean().default(false),
    logging: z.boolean().default(false),
});
export type DatabaseConfig_t = z.infer<typeof database_config_schema>;

/**
 * Config is a singleton that loads, validates and exposes runtime configuration.
 *
 * It prefers provided overrides (useful for tests) and falls back to the project's
 * default JSONC files imported at module scope.
 */
export class Config {
    /**
     * Singleton instance reference for the Config class. Set during getInstance().
     */
    private static instance: Config | null = null;

    /**
     * Shared `Logger` singleton for structured logging and localization-backed messages.
     * @static
     * @type {Logger}
     */
    private static logger: Logger = Logger.getInstance();

    /**
     * The currently loaded and validated bot configuration.
     * @readonly
     * @type {BotConfig_t}
     */
    public readonly current_botcfg: BotConfig_t;

    /**
     * The currently loaded and validated database configuration.
     * @readonly
     * @type {DatabaseConfig_t}
     */
    public readonly current_dbcfg: DatabaseConfig_t;

    /**
     * Parse raw configuration data using the provided Zod schema.
     *
     * Behavior:
     * - If `data` is a string, it reads the file contents and parses JSON.
     * - If `data` is already an object, it validates that object directly.
     * - On validation or parse error, an error is logged and an empty object cast to T is returned.
     *
     * @template T
     * @param {string|object} data Path to a JSON file or an in-memory object to validate.
     * @param {z.ZodType<T>} schema A Zod schema instance that validates the shape of T.
     * @returns {T} The validated configuration typed as T. Returns {} as T on error.
     */
    private parse<T>(data: string | object, schema: z.ZodType<T>): T {
        try {
            let raw_data: T;
            if (typeof data === 'string') {
                raw_data = JSON.parse(fs.readFileSync(data, 'utf-8')) as T;
            } else {
                raw_data = data as T;
            }
            const parsed = schema.parse(raw_data);
            return parsed;
        } catch (error) {
            Config.logger.send('error', 'services.config.parse.failed', {
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return {} as T;
        }
    }

    /**
     * Return the singleton Config instance, creating it if necessary.
     *
     * @param {BotConfig_t} [c_botcfg] Optional override for bot configuration (useful in tests).
     * @param {DatabaseConfig_t} [c_dbcfg] Optional override for database configuration.
     * @returns {Config} Singleton instance with validated configurations loaded.
     */
    public static getInstance(c_botcfg?: BotConfig_t, c_dbcfg?: DatabaseConfig_t): Config {
        if (!Config.instance) {
            Config.instance = new Config(c_botcfg, c_dbcfg);
        }
        return Config.instance;
    }

    /**
     * Internal constructor: validates and stores current configurations.
     *
     * @param {BotConfig_t} [c_botcfg] Optional bot config override.
     * @param {DatabaseConfig_t} [c_dbcfg] Optional database config override.
     */
    private constructor(c_botcfg?: BotConfig_t, c_dbcfg?: DatabaseConfig_t) {
        this.current_botcfg = this.parse(c_botcfg || botcfg, bot_config_schema as z.ZodType<BotConfig_t>);
        this.current_dbcfg = this.parse(c_dbcfg || dbcfg, database_config_schema as z.ZodType<DatabaseConfig_t>);
    }
}
