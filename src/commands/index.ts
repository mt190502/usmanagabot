import { Config } from '@services/config';
import { Database } from '@services/database';
import { Logger } from '@services/logger';
import { Translator } from '@services/translator';
import { Guilds } from '@src/types/database/entities/guilds';
import { Users } from '@src/types/database/entities/users';
import { BaseCommand, CustomizableCommand } from '@src/types/structure/command';
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
import { setTimeout } from 'timers/promises';
import { TypeORMError } from 'typeorm';

/**
 * Manages the loading, registration, and deployment of application commands.
 *
 * This static class is responsible for several key functions:
 * - Discovering command modules within the filesystem.
 * - Building and maintaining in-memory collections of commands, scoped globally or per-guild.
 * - Preparing command data for the Discord API by converting it to JSON format.
 * - Deploying commands to Discord and handling updates.
 *
 * The CommandLoader is initialized once at startup by calling `BotClient.init()`, which in turn
 * calls `CommandLoader.init()`. After initialization, commands can be accessed via `CommandLoader.BotCommands`.
 */
export class CommandLoader {
    /**
     * An in-memory registry of all available commands, categorized by their scope ('global' or a guild ID).
     * The outer map's key is the scope, and its value is a map of command names to their instances.
     */
    public static BotCommands: Map<string, Map<string, BaseCommand | CustomizableCommand>> = new Map();

    /**
     * The static `Config` class, providing access to bot and database configurations.
     */
    private static config: typeof Config = Config;

    /**
     * The static `Translator` class, used for localizing log messages.
     */
    private static translator: typeof Translator = Translator;

    /**
     * The static `Logger` class, used for structured logging.
     */
    private static logger: typeof Logger = Logger;

    /**
     * A collection of command payloads formatted for the Discord REST API.
     * The key is the scope (a guild ID or 'global'), and the value is a Set of command JSON bodies.
     */
    private static rest_commands: Collection<
        string,
        Set<RESTPostAPIChatInputApplicationCommandsJSONBody | RESTPostAPIContextMenuApplicationCommandsJSONBody>
    > = new Collection();

    /**
     * Ensures all guilds the bot is in are present in the database.
     *
     * This method creates a temporary client to fetch all guilds, then saves
     * any new ones to the database. It also ensures a 'root' system user exists.
     * It is designed to run only if the database connection is available.
     *
     * @returns A promise that resolves to the list of all guilds from the database,
     * or `undefined` if the process could not complete.
     */
    private static async registerGuilds(): Promise<Guilds[] | undefined> {
        if (!Database.dataSource) return;

        const client = new Client({ intents: [GatewayIntentBits.Guilds] });
        await client.login(CommandLoader.config.current_botcfg.token);
        await setTimeout(1000);

        if (!client.guilds.cache.size) {
            CommandLoader.logger.send('services', 'command_loader', 'error', 'registerGuilds.no_guilds_found');
            return;
        }

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
        await client.destroy();
        return await Database.dbManager.find(Guilds);
    }

    /**
     * Finds command files on the filesystem.
     *
     * If a `custom_command` is provided, it returns an array containing only that command.
     * Otherwise, it scans the `commands` directory for all `.ts` files (excluding `index.ts`).
     *
     * @param custom_command An optional, specific command instance to load.
     * @returns An array of file paths or a single command instance.
     */
    private static getCommandFiles(custom_command?: CustomizableCommand) {
        return custom_command
            ? [custom_command]
            : globSync(path.join(__dirname, './**/*.ts'), { ignore: ['**/index.ts'] });
    }

    /**
     * Imports command modules and instantiates their classes.
     *
     * It processes an array of file paths or a direct command instance,
     * dynamically imports the modules, and creates new instances of the command classes.
     *
     * @param command_files An array of file paths or a command instance.
     * @returns A promise that resolves to an array of objects, each containing the command's
     * filename and the instantiated command data.
     */
    private static async loadCommands(
        command_files: (string | CustomizableCommand)[],
    ): Promise<{ name: string; data: BaseCommand | CustomizableCommand }[]> {
        const commands: { name: string; data: BaseCommand | CustomizableCommand }[] = [];
        for (const file of command_files) {
            let file_name_with_path = '';
            if (typeof file === 'string') {
                file_name_with_path = file.match(/([^/]+\/[^/]+\/[^/]+)$/)![0];
                const content = (await import(file)).default;
                if (Array.isArray(content)) {
                    for (const cmd_class of content) {
                        commands.push({ name: file_name_with_path, data: new cmd_class() });
                    }
                } else {
                    commands.push({ name: file_name_with_path, data: new content() });
                }
            } else {
                file_name_with_path = 'inline';
                commands.push({ name: file_name_with_path, data: file });
            }
        }
        return commands;
    }

    /**
     * Prepares command data for API deployment.
     *
     * This method iterates through loaded commands, determines their scope (global or guild-specific),
     * clones and localizes them if they are customizable, and populates the `BotCommands` and
     * `rest_commands` collections with the final data.
     *
     * @param commands The array of loaded command data.
     * @param guilds The list of all guilds from the database.
     * @param custom_command An optional, specific command instance being processed.
     */
    private static async prepareRestCommands(
        commands: { name: string; data: BaseCommand | CustomizableCommand }[],
        guilds: Guilds[] | undefined,
        custom_command?: CustomizableCommand,
    ): Promise<void> {
        for (const { name: filename, data: cmd } of commands) {
            if (!cmd.name) {
                CommandLoader.logger.send('services', 'command_loader', 'info', 'readCommandFiles.invalid_name', {
                    name: filename,
                });
                continue;
            }

            if (!cmd.enabled && !custom_command) {
                CommandLoader.logger.send('services', 'command_loader', 'info', 'readCommandFiles.command_disabled', {
                    name: cmd.name,
                });
                continue;
            }
            CommandLoader.logger.send('services', 'command_loader', 'log', 'readCommandFiles.command_loading', {
                name: cmd.name,
                filename: filename,
            });

            const targets =
                cmd instanceof CustomizableCommand && guilds?.length ? guilds.map((g) => g.gid.toString()) : ['global'];
            for (const guild of targets) {
                if (custom_command) {
                    const rest_entry = CommandLoader.rest_commands.get(guild);
                    if (rest_entry) {
                        for (const entry of rest_entry) {
                            if (entry.name === cmd.name) {
                                rest_entry.delete(entry);
                            }
                        }
                    }
                }
                if (!CommandLoader.BotCommands.has(guild)) {
                    CommandLoader.BotCommands.set(guild, new Map());
                    CommandLoader.rest_commands.set(guild, new Set());
                }
                let cloned: BaseCommand | CustomizableCommand = cmd;
                if (
                    cmd instanceof CustomizableCommand &&
                    !(cmd.base_cmd_data instanceof ContextMenuCommandBuilder) &&
                    guild !== 'global'
                ) {
                    cloned = Object.assign(Object.create(Object.getPrototypeOf(cmd)), cmd);
                    CommandLoader.translator.setGuildLanguage = {
                        id: BigInt(guild),
                        language: guilds!.find((g) => g.gid.toString() === guild)!.country,
                    };
                    await (cloned as CustomizableCommand).prepareCommandData(BigInt(guild));
                }
                CommandLoader.BotCommands.get(guild)!.set(cloned.name, cloned);
                for (const c of cloned.all_cmd_data) {
                    if (!cloned.enabled) {
                        CommandLoader.logger.send(
                            'services',
                            'command_loader',
                            'info',
                            'readCommandFiles.custom_disabled',
                            {
                                name: cloned.name,
                                guild: guild,
                            },
                        );
                        continue;
                    }
                    if (c) CommandLoader.rest_commands.get(guild)!.add(c.toJSON());
                }
            }
        }
    }

    /**
     * Orchestrates the entire process of finding, loading, and preparing command files.
     *
     * This method serves as a wrapper that:
     * 1. Fetches guild data from the database, registering them if necessary.
     * 2. Finds all command files using `getCommandFiles`.
     * 3. Loads and instantiates them using `loadCommands`.
     * 4. Prepares them for the API using `prepareRestCommands`.
     *
     * @param custom_command An optional command to process instead of all commands.
     */
    private static async readCommandFiles(custom_command?: CustomizableCommand): Promise<void> {
        let guilds: Guilds[] | undefined;
        try {
            guilds = await Database.dbManager.find(Guilds);
        } catch (error) {
            if (error instanceof TypeORMError && error.message.includes('No metadata for')) {
                CommandLoader.logger.send(
                    'services',
                    'command_loader',
                    'error',
                    'readCommandFiles.database_metadata_missing',
                );
            }
        }

        if (guilds?.length === 0) guilds = await CommandLoader.registerGuilds();

        const command_files = CommandLoader.getCommandFiles(custom_command);
        const commands = await CommandLoader.loadCommands(command_files);
        await CommandLoader.prepareRestCommands(commands, guilds, custom_command);
    }

    /**
     * A helper function to deploy commands to a specific API route.
     *
     * It can optionally clear all existing commands at that route before deploying the new set.
     *
     * @param rest The configured REST client.
     * @param route The API endpoint (global or guild-specific).
     * @param commands A Set of command JSON bodies to deploy.
     * @param clear Whether to delete old commands before deploying.
     */
    private static async putCommands(
        rest: REST,
        route: `/${string}`,
        commands: Set<
            RESTPostAPIChatInputApplicationCommandsJSONBody | RESTPostAPIContextMenuApplicationCommandsJSONBody
        >,
        clear: boolean,
    ) {
        if (clear) {
            await rest.put(route, { body: [] });
        }
        await rest.put(route, { body: Array.from(commands.values()) });
    }

    /**
     * Deploys all prepared commands to Discord.
     *
     * This method first loads/re-loads all command data, then iterates through the
     * `rest_commands` collection and deploys each set of commands (global and per-guild)
     * to the appropriate Discord API endpoint.
     *
     * @param custom_command An optional specific command to re-deploy.
     * @param custom_guild An optional guild ID to limit the deployment scope.
     */
    public static async RESTCommandLoader(custom_command?: CustomizableCommand, custom_guild?: string): Promise<void> {
        await CommandLoader.readCommandFiles(custom_command);
        const cfg = CommandLoader.config.current_botcfg;
        const rest = new REST({ version: '10' }).setToken(cfg.token);

        for (const [guild_id, commands] of CommandLoader.rest_commands) {
            if (custom_guild && guild_id !== custom_guild) continue;
            try {
                const route =
                    guild_id === 'global'
                        ? Routes.applicationCommands(cfg.app_id)
                        : Routes.applicationGuildCommands(cfg.app_id, guild_id);
                await CommandLoader.putCommands(rest, route, commands, cfg.clear_old_commands_on_startup);
            } catch (error) {
                CommandLoader.logger.send('services', 'command_loader', 'error', 'RESTCommandLoader.failed', {
                    guild: guild_id,
                    message: (error as Error).message,
                });
            }
        }
    }

    /**
     * Initializes the command loading and deployment process.
     *
     * This is the main entry point for the `CommandLoader`. It triggers the
     * `RESTCommandLoader` to load and deploy all application commands at startup.
     * This method is called by `BotClient.init()`.
     */
    public static async init(): Promise<void> {
        await CommandLoader.RESTCommandLoader();
    }
}
