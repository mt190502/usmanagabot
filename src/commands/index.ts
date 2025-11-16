import { Config } from '@services/config';
import { Database } from '@services/database';
import { Logger } from '@services/logger';
import { Guilds } from '@src/types/database/entities/guilds';
import {
    Client,
    Collection,
    ContextMenuCommandBuilder,
    GatewayIntentBits,
    REST,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIContextMenuApplicationCommandsJSONBody,
    Routes,
} from 'discord.js';
import { globSync } from 'glob';
import path from 'path';
import timers from 'timers/promises';
import { TypeORMError } from 'typeorm';
import { Users } from '../types/database/entities/users';
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
        if (!Database.dataSource) return;

        const client = new Client({ intents: [GatewayIntentBits.Guilds] });
        await client.login(CommandLoader.config.current_botcfg.token);
        await timers.setTimeout(1000);

        if (!client.guilds.cache.size) {
            CommandLoader.logger.send('error', 'commandloader.registerGuilds.no_guilds_found');
            return;
        }

        try {
            for (const [id, guild] of client.guilds.cache) {
                const new_guild = new Guilds();
                new_guild.name = guild.name;
                new_guild.gid = BigInt(id);
                new_guild.country = guild.preferredLocale;
                await Database.dbManager.save(new_guild);
            }
            const system_user = new Users();
            system_user.uid = BigInt(0);
            system_user.name = 'root';
            await Database.dbManager.save(system_user);
        } catch (error) {
            CommandLoader.logger.send('error', 'commandloader.registerGuilds.database_save_failed', { message: (error as Error).message });
        }
        await client.destroy();
        return await Database.dbManager.find(Guilds);
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
    private async readCommandFiles(custom_command?: CustomizableCommand): Promise<void> {
        let guilds: Guilds[] | undefined;
        try {
            guilds = await Database.dbManager.find(Guilds);
        } catch (error) {
            if (error instanceof TypeORMError && error.message.includes('No metadata for')) {
                CommandLoader.logger.send('error', 'commandloader.readCommandFiles.database_metadata_missing');
            }
        }

        if (guilds?.length === 0) guilds = await this.registerGuilds();

        const commands = custom_command
            ? [custom_command]
            : globSync(path.join(__dirname, './**/*.ts'), { ignore: ['**/index.ts'] });

        for (const file of commands.sort()) {
            let cmd: BaseCommand | CustomizableCommand;
            let filename: string;
            if (custom_command) {
                cmd = custom_command;
                filename = 'inline';
            } else {
                const content = await import(file as string);
                if (!content || !content.default) continue;
                cmd = new content.default() as BaseCommand | CustomizableCommand;
                filename = (file as string).match(/([^/]+\/[^/]+\/[^/]+)$/)![1];
            }

            if (!cmd.name) {
                CommandLoader.logger.send('info', 'commandloader.readCommandFiles.invalid_name', { name: filename });
                continue;
            }

            if (!cmd.enabled && !custom_command) {
                CommandLoader.logger.send('info', 'commandloader.readCommandFiles.command_disabled', { name: cmd.name });
                continue;
            }
            CommandLoader.logger.send('log', 'commandloader.readCommandFiles.command_loading', { name: cmd.name, filename: filename });

            const targets =
                cmd instanceof CustomizableCommand && guilds?.length ? guilds.map((g) => g.gid.toString()) : ['global'];
            for (const guild of targets) {
                if (custom_command) {
                    const rest_entry = this.rest_commands.get(guild);
                    if (rest_entry) {
                        for (let i = rest_entry.length - 1; i >= 0; i--) {
                            if (rest_entry[i].name === cmd.name) {
                                rest_entry.splice(i, 1);
                            }
                        }
                    }
                }
                if (!CommandLoader.BotCommands.has(guild)) {
                    CommandLoader.BotCommands.set(guild, new Map());
                    this.rest_commands.set(guild, []);
                }
                if (
                    cmd instanceof CustomizableCommand &&
                    !(cmd.base_cmd_data instanceof ContextMenuCommandBuilder) &&
                    guild !== 'global'
                ) {
                    await cmd.prepareCommandData(BigInt(guild));
                }
                CommandLoader.BotCommands.get(guild)!.set(cmd.name, cmd);
                for (const c of cmd.all_cmd_data) {
                    if (!cmd.enabled) {
                        CommandLoader.logger.send('info', 'commandloader.readCommandFiles.custom_disabled', {
                            name: cmd.name,
                            guild: guild,
                        });
                        continue;
                    }
                    if (c) this.rest_commands.get(guild)!.push(c.toJSON());
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
    public async RESTCommandLoader(custom_command?: CustomizableCommand, custom_guild?: string): Promise<void> {
        await this.readCommandFiles(custom_command);
        const cfg = CommandLoader.config.current_botcfg;
        const rest = new REST({ version: '10' }).setToken(cfg.token);
        for (const [guild_id, commands] of this.rest_commands) {
            if (custom_guild && guild_id !== custom_guild) continue;
            try {
                if (guild_id === 'global') {
                    if (cfg.clear_old_commands_on_startup) {
                        await rest.put(Routes.applicationCommands(cfg.app_id), {
                            body: [],
                        });
                    }
                    await rest.put(Routes.applicationCommands(cfg.app_id), {
                        body: Object.values(commands),
                    });
                } else {
                    if (cfg.clear_old_commands_on_startup) {
                        await rest.put(Routes.applicationGuildCommands(cfg.app_id, guild_id), {
                            body: [],
                        });
                    }
                    await rest.put(Routes.applicationGuildCommands(cfg.app_id, guild_id), {
                        body: Object.values(commands),
                    });
                }
            } catch (error) {
                CommandLoader.logger.send('error', 'commandloader.RESTCommandLoader.failed', { guild: guild_id, message: (error as Error).message });
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
        await this.instance.RESTCommandLoader();
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
