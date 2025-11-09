import { Config } from '@services/config';
import { Database } from '@services/database';
import { Logger } from '@services/logger';
import { Guilds } from '@src/types/database/entities/guilds';
import {
    Client,
    Collection,
    GatewayIntentBits,
    REST,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIContextMenuApplicationCommandsJSONBody,
    Routes,
    SlashCommandBuilder,
} from 'discord.js';
import { globSync } from 'glob';
import path from 'path';
import timers from 'timers/promises';
import { TypeORMError } from 'typeorm';
import { BaseCommand, CustomizableCommand } from '../types/structure/command';

/**
 * Manages the loading, registration, and deployment of application commands.
 *
 * This class is responsible for several key functions:
 * - Discovering command modules within the filesystem.
 * - Building and maintaining in-memory collections of commands, scoped globally or per-guild.
 * - Preparing command data for the Discord API by converting it to JSON format.
 * - Deploying commands to Discord and handling updates.
 *
 * The CommandLoader should be initialized once at startup by calling `CommandLoader.init()`.
 * After initialization, commands can be accessed via `CommandLoader.BotCommands`.
 */
export class CommandLoader {
    /**
     * The singleton instance of the CommandLoader.
     * This is set during the `init()` method and is null until initialization.
     * @public
     * @static
     * @type {(CommandLoader | null)}
     */
    public static instance: CommandLoader | null = null;

    /**
     * An in-memory registry of all available commands, categorized by their scope.
     *
     * This map uses either the guild ID for guild-specific commands or 'global' for global commands as keys.
     * The value is another map where the key is the command name and the value is the command instance.
     *
     * @public
     * @static
     * @type {Map<string, Map<string, BaseCommand | CustomizableCommand>>}
     */
    public static BotCommands: Map<string, Map<string, BaseCommand | CustomizableCommand>> = new Map();

    /**
     * The cached bot configuration.
     * This is used for authentication with the Discord API and for various command deployment settings.
     * @private
     * @static
     * @type {Config}
     */
    private static config: Config = Config.getInstance();

    /**
     * A promise that resolves to the shared `Database` singleton instance.
     * This is used for all database interactions, such as querying or persisting guild data.
     * @private
     * @static
     * @type {Promise<Database>}
     */
    private static database: Promise<Database> = Database.getInstance();

    /**
     * The shared `Logger` singleton instance.
     * This is used for structured logging throughout the command loading process.
     * @private
     * @static
     * @type {Logger}
     */
    private static logger: Logger = Logger.getInstance();

    /**
     * A collection of command payloads ready for deployment via the Discord REST API.
     *
     * This collection mirrors the structure of `BotCommands`, with keys for each guild ID or '0' (global).
     * The values are arrays of JSON bodies for each command, prepared for the API.
     *
     * @private
     * @type {Collection<string, (RESTPostAPIChatInputApplicationCommandsJSONBody | RESTPostAPIContextMenuApplicationCommandsJSONBody)[]>}
     */
    private rest_commands: Collection<
        string,
        (RESTPostAPIChatInputApplicationCommandsJSONBody | RESTPostAPIContextMenuApplicationCommandsJSONBody)[]
    > = new Collection();

    /**
     * Ensures that all guilds the bot is a member of are registered in the database.
     *
     * This method uses a temporary client to fetch the list of guilds and saves any new ones to the database.
     * It's designed to be defensive, returning early if the database is not yet initialized.
     *
     * @private
     * @async
     * @returns {Promise<Guilds[] | undefined>} - A promise that resolves to the list of registered guilds, or undefined if registration could not be completed.
     */
    private async registerGuilds(): Promise<Guilds[] | undefined> {
        const db = await CommandLoader.database;
        if (!db.dataSource) return;

        const client = new Client({ intents: [GatewayIntentBits.Guilds] });
        await client.login(CommandLoader.config.current_botcfg.token);
        await timers.setTimeout(1000);

        if (!client.guilds.cache.size) {
            CommandLoader.logger.send('error', 'commandloader.register_guilds.no_guild_error');
            return;
        }

        try {
            for (const [id, guild] of client.guilds.cache) {
                const new_guild = new Guilds();
                new_guild.name = guild.name;
                new_guild.gid = BigInt(id);
                new_guild.country = guild.preferredLocale;
                await db.dataSource.manager.save(new_guild);
            }
        } catch (error) {
            CommandLoader.logger.send('error', 'commandloader.register_guilds.database.guild_save_error', [
                (error as Error).message,
            ]);
        }
        await client.destroy();
        return await db.dataSource.manager.find(Guilds);
    }

    /**
     * Discovers and reads command files from the filesystem.
     *
     * This method populates the `BotCommands` and `rest_commands` collections.
     * It handles both global commands and commands that can be customized per guild.
     *
     * @private
     * @async
     * @param {string} [custom_command] - An optional path to a specific command file to load. If not provided, all command files will be loaded.
     * @returns {Promise<void>} A promise that resolves once all command files have been processed.
     */
    private async readCommandFiles(custom_command?: string): Promise<void> {
        let guilds: Guilds[] | undefined;
        try {
            guilds = await (await CommandLoader.database).dataSource?.manager.find(Guilds);
        } catch (error) {
            if (error instanceof TypeORMError && error.message.includes('No metadata for')) {
                CommandLoader.logger.send('error', 'commandloader.read_command_files.database.no_metadata');
            }
        }

        if (guilds?.length === 0) guilds = await this.registerGuilds();

        const commands = custom_command
            ? [custom_command]
            : globSync(path.join(__dirname, './**/*.ts'), { ignore: ['**/index.ts'] });

        for (const file of commands.sort()) {
            const content = await import(file);
            if (!content || !content.default) continue;
            const cmd = new content.default() as BaseCommand | CustomizableCommand;
            const filename = file.match(/([^/]+\/[^/]+\/[^/]+)$/)![1];

            if (!cmd.name) {
                CommandLoader.logger.send('error', 'commandloader.read_command_files.noname', [filename]);
                continue;
            }

            if (!cmd.enabled) {
                CommandLoader.logger.send('info', 'commandloader.read_command_files.disabled', [cmd.name]);
                continue;
            }
            CommandLoader.logger.send('info', 'commandloader.read_command_files.loading', [cmd.name, filename]);

            const targets =
                cmd instanceof CustomizableCommand && guilds?.length ? guilds.map((g) => g.gid.toString()) : ['global'];
            for (const guild of targets) {
                if (!CommandLoader.BotCommands.has(guild)) {
                    CommandLoader.BotCommands.set(guild, new Map());
                    this.rest_commands.set(guild, []);
                }
                if (cmd instanceof CustomizableCommand && cmd.base_cmd_data instanceof SlashCommandBuilder && guild !== 'global') {
                    await cmd.generateSlashCommandData(BigInt(guild));
                }
                CommandLoader.BotCommands.get(guild)!.set(cmd.name, cmd);
                for (const c of cmd.all_cmd_data) {
                    this.rest_commands.get(guild)!.push(c.toJSON());
                }
            }
        }
    }

    /**
     * Deploys the registered commands to Discord via the REST API.
     *
     * This method handles the deployment of both global and guild-specific commands.
     * It can also be configured to clear old commands before deploying new ones.
     *
     * @private
     * @async
     * @param {string} [custom_command] - An optional path to a specific command file to deploy.
     * @param {bigint} [custom_guild] - An optional guild ID to limit the deployment to a single guild.
     * @returns {Promise<void>} A promise that resolves once the deployment is complete.
     */
    private async restCommandLoader(custom_command?: string, custom_guild?: bigint): Promise<void> {
        await this.readCommandFiles(custom_command);
        const rest = new REST({ version: '10' }).setToken(CommandLoader.config.current_botcfg.token);
        for (const [guild_id, commands] of this.rest_commands) {
            if (custom_guild && BigInt(guild_id) !== custom_guild) continue;
            try {
                if (guild_id === 'global') {
                    if (CommandLoader.config.current_botcfg.clear_old_commands_on_startup) {
                        await rest.put(Routes.applicationCommands(CommandLoader.config.current_botcfg.app_id), {
                            body: [],
                        });
                    }
                    await rest.put(Routes.applicationCommands(CommandLoader.config.current_botcfg.app_id), {
                        body: Object.values(commands),
                    });
                } else {
                    if (CommandLoader.config.current_botcfg.clear_old_commands_on_startup) {
                        await rest.put(
                            Routes.applicationGuildCommands(CommandLoader.config.current_botcfg.app_id, guild_id),
                            {
                                body: [],
                            },
                        );
                    }
                    await rest.put(
                        Routes.applicationGuildCommands(CommandLoader.config.current_botcfg.app_id, guild_id),
                        {
                            body: Object.values(commands),
                        },
                    );
                }
            } catch (error) {
                CommandLoader.logger.send('error', 'commandloader.rest_command_loader.rest_error', [
                    guild_id,
                    (error as Error).message,
                ]);
            }
        }
    }

    /**
     * Initializes the CommandLoader.
     *
     * This method creates the singleton instance, loads all commands, and deploys them.
     * It ensures that it only runs once, making subsequent calls have no effect.
     *
     * @public
     * @static
     * @async
     * @returns {Promise<void>} A promise that resolves once the initialization and deployment are complete.
     */
    public static async init(): Promise<void> {
        if (CommandLoader.instance) {
            return;
        }
        this.instance = new CommandLoader();
        await this.instance.restCommandLoader();
    }

    /**
     * Retrieves the singleton instance of the CommandLoader.
     *
     * If an instance does not already exist, a new one will be created.
     *
     * @public
     * @static
     * @returns {CommandLoader} The singleton instance of the CommandLoader.
     */
    public static getInstance(): CommandLoader {
        if (!CommandLoader.instance) {
            CommandLoader.instance = new CommandLoader();
        }
        return CommandLoader.instance;
    }
}
