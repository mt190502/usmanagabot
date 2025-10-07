import botcfg from '@config/bot.jsonc';
import dbcfg from '@config/database.jsonc';
import fs from 'fs';
import { z } from 'zod';
import { Logger, LogLevels, SupportedLanguages } from './logger';

/**
 * Schema for validating the bot configuration.
 * This schema defines the structure and validation rules for the bot configuration.
 * @property {string} app_id - The application ID of the bot.
 * @property {boolean} clear_old_commands_on_startup - Whether to clear old commands on startup.
 * @property {enum<SupportedLanguages>} language - The default language for the bot.
 * @property {string} log_level - The logging level for the bot.
 * @property {object} management - Configuration for management features.
 * @property {boolean} management.enabled - Whether management features are enabled.
 * @property {string} management.main_guild_id - The main guild ID for management features.
 * @property {string} management.channel_id - The channel ID for management features.
 * @property {string} token - The bot token for authentication.
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
 * Schema for validating the database configuration.
 * This schema defines the structure and validation rules for the database configuration.
 * @property {string} host - The database host.
 * @property {number} port - The database port.
 * @property {string} username - The database username.
 * @property {string} password - The database password (optional).
 * @property {string} database - The name of the database.
 * @property {boolean} synchronize - Whether to synchronize the database schema.
 * @property {boolean} logging - Whether to enable logging for database operations.
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
 * Config class for managing the bot and database configurations.
 * This class provides methods to initialize and access the current configurations.
 */
export class Config {
    private static instance: Config | null = null;
    private static logger = Logger.getInstance();
    public readonly current_botcfg: BotConfig_t;
    public readonly current_dbcfg: DatabaseConfig_t;

    /**
     * Parses the provided data using the specified schema.
     * If the data is a string, it reads the content from the file.
     * If the data is an object, it parses it directly.
     * @param {string | object} data - The configuration data to parse.
     * @param {z.ZodType<T>} schema - The Zod schema to validate the data against.
     * @return {T} The parsed and validated configuration data.
     */
    private parse<T>(data: string | object, schema: z.ZodType<T>): T {
        try {
            let raw_data: T;
            if (typeof data === 'string') {
                const file_content = fs.readFileSync(data, 'utf-8');
                raw_data = JSON.parse(file_content) as T;
            } else {
                raw_data = data as T;
            }
            const parsed = schema.parse(raw_data);
            return parsed;
        } catch (error) {
            Config.logger.send('error', 'services.config.parsing_error', [
                error instanceof Error ? error.message : 'Unknown error',
            ]);
            return {} as T;
        }
    }

    /**
     * Initializes the Config instance with the provided bot and database configurations.
     * If no configurations are provided, it uses default configurations.
     * @param {BotConfig_t} c_botcfg - Optional bot configuration object.
     * @param {DatabaseConfig_t} c_dbcfg - Optional database configuration object.
     * @return An instance of Config with the initialized configurations.
     */
    public static getInstance(c_botcfg?: BotConfig_t, c_dbcfg?: DatabaseConfig_t): Config {
        if (!Config.instance) {
            Config.instance = new Config(c_botcfg, c_dbcfg);
        }
        return Config.instance;
    }

    /**
     * Initializes the Config instance with the provided bot and database configurations.
     * @param {BotConfig_t} c_botcfg - Optional bot configuration object.
     * @param {DatabaseConfig_t} c_dbcfg - Optional database configuration object.
     */
    private constructor(c_botcfg?: BotConfig_t, c_dbcfg?: DatabaseConfig_t) {
        this.current_botcfg = this.parse(c_botcfg || botcfg, bot_config_schema as z.ZodType<BotConfig_t>);
        this.current_dbcfg = this.parse(c_dbcfg || dbcfg, database_config_schema as z.ZodType<DatabaseConfig_t>);
    }
}
