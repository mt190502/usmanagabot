import {
    ActionRowBuilder,
    ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    Colors,
    CommandInteraction,
    ContextMenuCommandBuilder,
    EmbedBuilder,
    Interaction,
    MessageFlags,
    ModalSubmitInteraction,
    RoleSelectMenuInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import 'reflect-metadata';
import { format } from 'util';
import { Config } from '../../services/config';
import { Database } from '../../services/database';
import { Logger } from '../../services/logger';
import { DatabaseManager } from './database';

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
    public enabled: boolean = true;

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
     * Indicates whether the command requires administrator privileges to use.
     * @public
     * @readonly
     * @type {boolean}
     */
    public readonly is_admin_command: boolean = false;

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
    private main_command_data: SlashCommandBuilder | ContextMenuCommandBuilder | null = null;

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
    public abstract execute(interaction: Interaction | CommandInteraction | unknown): Promise<void>;

    /**
     * Constructs a new instance of the BaseCommand.
     * @param {Partial<BaseCommand> & { name: string }} options - The options to initialize the command with.
     */
    constructor(options: Partial<BaseCommand> & { name: string }) {
        this.enabled = options.enabled ?? true;
        this.name = options.name;
        this.pretty_name = options.pretty_name ?? 'No pretty name provided.';
        this.description = options.description ?? 'No description provided.';
        this.is_admin_command = options.is_admin_command ?? false;
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

    protected get db(): DatabaseManager {
        return Database.dbManager;
    }

    /**
     * Gets the primary command data builder.
     * @public
     * @returns {SlashCommandBuilder | ContextMenuCommandBuilder} The main command data.
     */
    public get base_cmd_data(): SlashCommandBuilder | ContextMenuCommandBuilder | null {
        return this.main_command_data;
    }

    /**
     * Sets the primary command data builder.
     * @public
     * @param {SlashCommandBuilder | ContextMenuCommandBuilder} data - The main command data to set.
     */
    public set base_cmd_data(data: SlashCommandBuilder | ContextMenuCommandBuilder | null) {
        this.main_command_data = data;
    }

    /**
     * Gets an array containing the main command data builder and any extra command data builders.
     * @public
     * @returns {(SlashCommandBuilder | ContextMenuCommandBuilder)[]} An array of all command data.
     */
    public get all_cmd_data(): (SlashCommandBuilder | ContextMenuCommandBuilder | null)[] {
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
    protected warning: string | null = null;
    // ================================================================ //

    // ============== CUSTOMIZABLE COMMAND BASE SECTION =============== //
    public abstract generateSlashCommandData(guild_id: bigint): Promise<void>;

    public async settingsUI(
        interaction:
            | ChatInputCommandInteraction
            | ChannelSelectMenuInteraction
            | StringSelectMenuInteraction
            | ModalSubmitInteraction
            | RoleSelectMenuInteraction,
    ): Promise<void> {
        const subsettings = Reflect.getMetadata('custom:settings', this.constructor);
        const ui = new EmbedBuilder().setTitle(`:gear: ${this.pretty_name} Settings`);
        const menu = new StringSelectMenuBuilder().setCustomId(`settings:${this.name}`);

        if (this.warning) {
            ui.setColor(Colors.Yellow);
            ui.addFields({ name: ':warning:', value: this.warning });
            this.warning = null;
        } else {
            ui.setColor(Colors.Blurple);
        }

        for (const [name, setting] of subsettings) {
            if (setting.display_name) {
                let row;
                if (setting.db_column_is_array) {
                    const rows = await this.db.find(setting.database, {
                        where: { from_guild: { gid: BigInt(interaction.guildId!) } },
                    });
                    row = rows.map((r) => r[setting.database_key as keyof unknown]);
                } else {
                    row = (await this.db.findOne(setting.database, {
                        where: { from_guild: { gid: BigInt(interaction.guildId!) } },
                    }))![setting.database_key as keyof unknown];
                }
                let value;
                if (typeof row === 'boolean') {
                    value = row ? ':green_circle: True' : ':red_circle: False';
                } else if (setting.db_column_is_array) {
                    value = setting.database_key
                        ? Array.isArray(row) && row.length > 0
                            ? row.map((val: string | number) => format(setting.format_specifier, val)).join(', ')
                            : ':orange_circle: Not Set'
                        : '`View in Edit Mode`';
                } else {
                    value = setting.database_key
                        ? row
                            ? format(setting.format_specifier, row ?? '')
                            : ':orange_circle: Not Set'
                        : '`View in Edit Mode`';
                }
                ui.addFields({
                    name: setting.display_name,
                    value: value,
                });
            }
            menu.addOptions({
                label: setting.pretty,
                description: setting.description,
                value: `settings:${this.name}:${name}`,
            });
        }
        menu.addOptions({
            label: 'Back to Main Menu',
            description: 'Return to the main settings menu.',
            value: 'command:settings',
        });

        if (
            interaction.isChannelSelectMenu() ||
            interaction.isStringSelectMenu() ||
            interaction.isChatInputCommand() ||
            interaction.isRoleSelectMenu() ||
            interaction.isModalSubmit()
        ) {
            const payload = {
                embeds: [ui],
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu).toJSON()],
            };

            if (interaction.isChatInputCommand()) {
                if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
                else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
            } else if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
                await interaction.update(payload);
            } else if ((interaction.isModalSubmit() && interaction.isFromMessage()) || interaction.isRoleSelectMenu()) {
                if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
                else await interaction.update({ ...payload });
            }
        }
    }

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
