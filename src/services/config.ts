import botcfg from '@config/bot.jsonc';
import dbcfg from '@config/database.jsonc';
import { Logger, LogLevels } from '@services/logger';
import fs from 'fs';
import { env } from 'process';
import { z } from 'zod';
import { SupportedLanguages } from './translator';

/**
 * Configuration module.
 * Provides zod schemas and a singleton Config class that loads and validates
 * bot and database configuration from the repository defaults or provided overrides.
 */

/**
 * Helper function to parse environment variables for Zod schema parsing.
 *
 * @param {string} key The environment variable key to read.
 * @param {T} schema A Zod schema instance to validate the environment variable against.
 * @param {(v: z.infer<T>) => z.infer<T>} [parser] Optional parser function to transform the raw env var.
 */
const parseEnv = <T extends z.ZodType>(key: string, schema: T, parser?: (v: z.infer<T>) => z.infer<T>) => {
    return z.preprocess((val) => {
        const raw = env[key];
        if (raw === undefined) return val;
        return parser ? parser(raw as z.infer<T>) : raw;
    }, schema);
};

/**
 * Zod schema for the bot configuration.
 *
 * Validated properties:
 * - app_id: Discord application ID (string) - uses BOT__APP_ID env var if set, fallback to JSONC
 * - clear_old_commands_on_startup: whether to clear old commands on startup (boolean) - uses BOT__CLEAR_OLD_COMMANDS_ON_STARTUP env var if set, fallback to JSONC or false
 * - language: localization language (enum of SupportedLanguages) - uses BOT__LANGUAGE env var if set, fallback to JSONC or SupportedLanguages.EN
 * - log_level: logging level (enum of LogLevels) - uses BOT__LOG_LEVEL env var if set, fallback to JSONC or debug/error based on NODE_ENV
 * - management: object containing management channel_id, guild_id, user_id (all strings) - uses BOT__MANAGEMENT__* env vars if set, fallback to JSONC
 * - token: Discord bot token (string) - uses BOT__TOKEN env var if set, fallback to JSONC
 */
const bot_config_schema = z.object({
    app_id: parseEnv('BOT__APP_ID', z.string().min(1, 'Application ID cannot be empty')),
    clear_old_commands_on_startup: parseEnv('BOT__CLEAR_OLD_COMMANDS_ON_STARTUP', z.boolean().default(false), (v) => {
        if (typeof v === 'string') {
            return (v as string).toLowerCase() === 'true';
        }
        return v;
    }),
    language: parseEnv(
        'BOT__LANGUAGE',
        z
            .enum(SupportedLanguages, {
                message: 'Invalid language',
            })
            .default(SupportedLanguages.EN),
    ),
    log_level: parseEnv(
        'BOT__LOG_LEVEL',
        z
            .enum(LogLevels, {
                message: 'Invalid log level',
            })
            .default(process.env.NODE_ENV === 'production' ? LogLevels.error : LogLevels.debug),
        (v) => {
            if (isNaN(Number(v))) return v;
            return Number(v);
        },
    ),
    management: z.object({
        channel_id: parseEnv('BOT__MANAGEMENT__CHANNEL_ID', z.string().min(1, 'Management channel_id cannot be empty')),
        guild_id: parseEnv('BOT__MANAGEMENT__GUILD_ID', z.string().min(1, 'Management guild_id cannot be empty')),
        user_id: parseEnv('BOT__MANAGEMENT__USER_ID', z.string().min(1, 'Management user_id cannot be empty')),
    }),
    token: parseEnv('BOT__TOKEN', z.string().min(1, 'Bot token cannot be empty')),
});
export type BotConfig_t = z.infer<typeof bot_config_schema>;

/**
 * Zod schema for the database configuration.
 *
 * Validated properties:
 * - host: database host (string) - uses DB_HOST env var if set, fallback to JSONC or 'localhost'
 * - port: database port (number) - uses DB_PORT env var if set, fallback to JSONC or 5432
 * - username: database user (string) - uses DB_USERNAME env var if set, fallback to JSONC or 'usmanagabot'
 * - password: database password (string|undefined) - uses DB_PASSWORD env var if set, fallback to JSONC
 * - database: database name (string) - uses DB_DATABASE env var if set, fallback to JSONC or 'usmanagabot'
 * - synchronize: whether to synchronize schema (boolean) - uses DB_SYNCHRONIZE env var if set, fallback to JSONC or false
 * - logging: enable TypeORM logging (boolean) - uses DB_LOGGING env var if set, fallback to JSONC or false
 */
const database_config_schema = z.object({
    host: parseEnv('DB__HOST', z.string().min(1, 'Database host cannot be empty').default('localhost')),
    port: parseEnv('DB__PORT', z.number().min(1, 'Database port must be a positive integer').default(5432), (v) => {
        if (typeof v === 'string') {
            return parseInt(v, 10);
        }
        return v;
    }),
    username: parseEnv('DB__USERNAME', z.string().min(1, 'Database username cannot be empty').default('usmanagabot')),
    password: parseEnv('DB__PASSWORD', z.string().optional()),
    database: parseEnv('DB__DATABASE', z.string().min(1, 'Database name cannot be empty').default('usmanagabot')),
    synchronize: parseEnv('DB__SYNCHRONIZE', z.boolean().default(false), (v) => {
        if (typeof v === 'string') {
            return (v as string).toLowerCase() === 'true';
        }
        return v;
    }),
    logging: parseEnv('DB__LOGGING', z.boolean().default(false), (v) => {
        if (typeof v === 'string') {
            return (v as string).toLowerCase() === 'true';
        }
        return v;
    }),
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
