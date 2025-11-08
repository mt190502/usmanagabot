import { CommandInteraction, ContextMenuCommandBuilder, Interaction, SlashCommandBuilder } from 'discord.js';
import 'reflect-metadata';
import { EntityManager } from 'typeorm';
import { Config } from '../../services/config';
import { Database } from '../../services/database';
import { Logger } from '../../services/logger';

/**
 * An abstract class representing a base command.
 * All commands should extend this class or a class that extends it.
 */
export abstract class BaseCommand {
    // ======================== HEADER SECTION ======================== //
    /**
     * Specifies whether the command is enabled and should be registered.
     * @public
     * @readonly
     * @type {boolean}
     * @default true
     */
    public readonly enabled: boolean = true;

    /**
     * The unique name of the command.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly name: string;

    /**
     * A user-friendly, human-readable name for the command.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly pretty_name: string;

    /**
     * A brief summary of what the command does.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly description: string;

    /**
     * Instructions on how to use the command, including arguments.
     * Example: `/command [options]`
     * @public
     * @readonly
     * @type {string}
     */
    public readonly usage: string;

    /**
     * Detailed help text for the command, intended for display in a help command.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly help: string;

    /**
     * The duration in seconds that a user must wait before using the command again.
     * @public
     * @readonly
     * @type {number}
     * @default 0
     */
    public readonly cooldown: number;

    /**
     * An array of alternative names for the command.
     * @public
     * @readonly
     * @type {string[] | undefined}
     */
    public readonly aliases?: string[];
    // ================================================================ //

    // ===================== COMMAND DATA SECTION ===================== //
    /**
     * The primary command data builder for slash commands or context menus.
     * @private
     * @static
     * @type {(SlashCommandBuilder | ContextMenuCommandBuilder)}
     */
    private main_command_data: SlashCommandBuilder | ContextMenuCommandBuilder;

    /**
     * An array of additional command data builders.
     * @private
     * @static
     * @type {(SlashCommandBuilder | ContextMenuCommandBuilder)[]}
     */
    private extra_command_data: (SlashCommandBuilder | ContextMenuCommandBuilder)[] = [];
    // ================================================================ //

    // ===================== COMMAND BASE SECTION ===================== //
    /**
     * The main execution logic for the command.
     * @public
     * @abstract
     * @param {Interaction | CommandInteraction} interaction - The interaction object from Discord.js.
     * @returns {Promise<void>} A promise that resolves when the command execution is complete.
     */
    public abstract execute(interaction: Interaction | CommandInteraction): Promise<void>;

    /**
     * Constructs a new instance of the BaseCommand.
     * @param {Partial<BaseCommand> & { name: string }} options - The options to initialize the command with.
     */
    constructor(options: Partial<BaseCommand> & { name: string }) {
        this.enabled = options.enabled ?? true;
        this.name = options.name;
        this.pretty_name = options.pretty_name ?? 'No pretty name provided.';
        this.description = options.description ?? 'No description provided.';
        this.usage = options.usage ?? 'No usage provided.';
        this.help = options.help ?? 'No help provided.';
        this.cooldown = options.cooldown ?? 0;
        this.main_command_data = new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }
    // ================================================================ //

    // ================== COMMAND UTILITIES SECTION =================== //
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
    protected get db(): Promise<EntityManager> {
        return (async () => (await Database.getInstance()).dataSource!.manager)();
    }

    /**
     * Gets the primary command data builder.
     * @public
     * @returns {SlashCommandBuilder | ContextMenuCommandBuilder} The main command data.
     */
    public get base_cmd_data(): SlashCommandBuilder | ContextMenuCommandBuilder {
        return this.main_command_data;
    }

    /**
     * Sets the primary command data builder.
     * @public
     * @param {SlashCommandBuilder | ContextMenuCommandBuilder} data - The main command data to set.
     */
    public set base_cmd_data(data: SlashCommandBuilder | ContextMenuCommandBuilder) {
        this.main_command_data = data;
    }

    /**
     * Gets an array containing the main command data builder and any extra command data builders.
     * @public
     * @returns {(SlashCommandBuilder | ContextMenuCommandBuilder)[]} An array of all command data.
     */
    public get all_cmd_data(): (SlashCommandBuilder | ContextMenuCommandBuilder)[] {
        return [this.main_command_data, ...(this.extra_command_data ?? [])];
    }

    /**
     * Adds a new command data builder to the extra command data list.
     * @public
     * @param {SlashCommandBuilder | ContextMenuCommandBuilder} data - The command data to add.
     */
    public set push_cmd_data(data: SlashCommandBuilder | ContextMenuCommandBuilder) {
        this.extra_command_data.push(data);
    }
    // ================================================================ //
}

/**
 * Represents a command that can have guild-specific custom settings.
 * This class extends `BaseCommand` and is intended for commands that require per-guild configuration.
 */
export abstract class CustomizableCommand extends BaseCommand {
    // ============= CUSTOMIZABLE COMMAND HEADER SECTION ============== //
    // ================================================================ //

    // ============== CUSTOMIZABLE COMMAND DATA SECTION =============== //
    // ================================================================ //

    // ============== CUSTOMIZABLE COMMAND BASE SECTION =============== //
    /**
     * Constructs a new instance of the CustomizableCommand.
     * @param {Partial<CustomizableCommand> & { name: string }} options - The options to initialize the command with.
     */
    constructor(options: Partial<CustomizableCommand> & { name: string }) {
        super(options);
    }
    // ================================================================ //

    // ============ CUSTOMIZABLE COMMAND UTILITIES SECTION ============ //
    // ================================================================ //
}
