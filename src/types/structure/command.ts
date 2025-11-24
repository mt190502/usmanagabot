import {
    ActionRowBuilder,
    BaseInteraction,
    Colors,
    CommandInteraction,
    ContextMenuCommandBuilder,
    EmbedBuilder,
    Interaction,
    MessageFlags,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    User,
} from 'discord.js';
import moment from 'moment';
import 'reflect-metadata';
import { format } from 'util';
import { BotClient } from '../../services/client';
import { Config } from '../../services/config';
import { Database } from '../../services/database';
import { Logger } from '../../services/logger';
import { Translator } from '../../services/translator';
import { Paginator } from '../../utils/paginator';
import { Users } from '../database/entities/users';
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
     * Indicates whether the command is restricted to bot owners only.
     * @public
     * @readonly
     * @type {boolean}
     */
    public readonly is_bot_owner_command: boolean = false;

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
    private extra_command_data: Set<SlashCommandBuilder | ContextMenuCommandBuilder> = new Set();
    // ================================================================ //

    // ===================== COMMAND BASE SECTION ===================== //
    /**
     * The main execution logic for the command.
     * @public
     * @abstract
     * @param {Interaction | CommandInteraction} interaction - The interaction object from Discord.js.
     * @returns {Promise<void>} A promise that resolves when the command execution is complete.
     */
    public abstract execute(interaction: Interaction | CommandInteraction | unknown, args?: unknown): Promise<unknown>;

    /**
     * Constructs a new instance of the BaseCommand.
     * @param {Partial<BaseCommand> & { name: string }} options - The options to initialize the command with.
     */
    constructor(options: Partial<BaseCommand> & { name: string }) {
        this.enabled = options.enabled ?? true;
        this.name = options.name;
        this.pretty_name = this.t(options.pretty_name ?? 'pretty_name') ?? 'No pretty name provided.';
        this.description = this.t(options.description ?? 'description') ?? 'No description provided.';
        this.is_admin_command = options.is_admin_command ?? false;
        this.is_bot_owner_command = options.is_bot_owner_command ?? false;
        this.help = this.t(options.help ?? 'help') ?? 'No help provided.';
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
     * Provides access to the database manager.
     * @protected
     * @returns {DatabaseManager} The database manager instance.
     */
    protected get db(): DatabaseManager {
        return Database.dbManager;
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
     * Provides access to the paginator instance.
     * @protected
     * @returns {Paginator} The paginator instance.
     */
    protected get paginator(): Paginator {
        return Paginator.getInstance();
    }

    /**
     * Translate a command string using the commands localization category.
     * This method provides localization support for user-facing messages in commands.
     *
     * @protected
     * @param {string} key Localization key from the commands category (e.g., 'purge.warning.title')
     * @param {Record<string, unknown>} [replacements] Optional placeholder replacements for dynamic values
     * @returns {string} Translated message in the current language
     */
    protected t(key: string, replacements?: Record<string, unknown>): string {
        const translator = Translator.getInstance();
        return translator.querySync('commands', key, replacements);
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
        this.extra_command_data.add(data);
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
    /**
     * A warning message to be displayed in the settings UI, if any.
     * @protected
     * @type {string | null}
     */
    protected warning: string | null = null;
    // ================================================================ //

    // ============== CUSTOMIZABLE COMMAND BASE SECTION =============== //
    /**
     * Prepares the data for a specific guild. (database entries, loads defaults, etc.)
     * This method should be implemented by subclasses to initialize or load settings as needed.
     * @public
     * @abstract
     * @param {bigint} guild_id - The ID of the guild for which to prepare settings.
     * @returns {Promise<void>} A promise that resolves when the settings are prepared.
     */
    public abstract prepareCommandData(guild_id: bigint): Promise<void>;

    /**
     * Generates and sends the settings user interface for the command.
     * @public
     * @param {BaseInteraction | CommandInteraction} interaction - The interaction that triggered the settings UI.
     * @returns {Promise<void>} A promise that resolves when the settings UI has been sent.
     */
    public async settingsUI(interaction: BaseInteraction | CommandInteraction): Promise<void> {
        const subsettings = Reflect.getMetadata('custom:settings', this.constructor);
        const ui = new EmbedBuilder().setTitle(`:gear: ${this.t('settings.execute.title', { command: this.pretty_name })}`);
        const menu = new StringSelectMenuBuilder().setCustomId(`settings:${this.name}`).setPlaceholder(this.t('settings.execute.placeholder'));

        if (this.warning) {
            ui.setColor(Colors.Yellow);
            ui.addFields({ name: ':warning:', value: this.warning });
            this.warning = null;
        } else {
            ui.setColor(Colors.Blurple);
        }

        let latest_action_from_user: [Users | string | null, Date | null] = [null, null];
        for (const [name, setting] of subsettings) {
            if (setting.view_in_ui) {
                let row;
                if (setting.is_bot_owner_only) {
                    if (setting.db_column_is_array) {
                        const rows = await this.db.find(setting.database, {
                            where: { id: 1 },
                        });
                        row = rows.map((r) => r[setting.database_key as keyof unknown]);
                        if (Array.isArray(row[0])) row = row[0];
                    } else {
                        const db = (await this.db.findOne(setting.database, {
                            where: { id: 1 },
                        }))!;
                        latest_action_from_user = [
                            this.cfg.current_botcfg.management.user_id,
                            db['timestamp' as keyof unknown],
                        ];
                        row = db[setting.database_key as keyof unknown];
                    }
                } else {
                    if (setting.db_column_is_array) {
                        const rows = await this.db.find(setting.database, {
                            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
                        });
                        row = rows.map((r) => r[setting.database_key as keyof unknown]);
                        if (Array.isArray(row[0])) row = row[0];
                    } else {
                        const db = (await this.db.findOne(setting.database, {
                            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
                        }))!;
                        latest_action_from_user = [
                            db['latest_action_from_user' as keyof unknown],
                            db['timestamp' as keyof unknown],
                        ];
                        row = db[setting.database_key as keyof unknown];
                    }
                }
                let value;
                if (typeof row === 'boolean') {
                    value = row
                        ? `:green_circle: ${this.t('command.execute.true')}`
                        : `:red_circle: ${this.t('command.execute.false')}`;
                } else if (setting.db_column_is_array) {
                    value = setting.database_key
                        ? Array.isArray(row) && row.length > 0
                            ? row.length == 1 && row[0] === null
                                ? `:orange_circle: ${this.t('settings.execute.not_set')}`
                                : row.map((val) => format(setting.format_specifier, val)).join(', ')
                            : `:orange_circle: ${this.t('settings.execute.not_set')}`
                        : this.t('settings.execute.view_in_edit_mode');
                } else {
                    value = setting.database_key
                        ? row
                            ? format(setting.format_specifier, row ?? '')
                            : `:orange_circle: ${this.t('settings.execute.not_set')}`
                        : this.t('settings.execute.view_in_edit_mode');
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
            label: this.t('settings.execute.back_to_main_menu'),
            description: this.t('settings.execute.back_to_main_menu_description'),
            value: 'command:settings',
        });

        if (latest_action_from_user[0]) {
            let user: User | undefined;
            let date: string | null;
            if (typeof latest_action_from_user[0] === 'object') {
                const uid = BigInt((latest_action_from_user[0] as Users).uid);
                if (uid == 0n) {
                    user = BotClient.client.users.cache.get(BotClient.client.user!.id);
                    date = moment(latest_action_from_user[1]).format('YYYY/MM/DD HH:mm:ss Z');
                } else {
                    user = BotClient.client.users.cache.get(uid.toString());
                    date = moment(latest_action_from_user[1]).format('YYYY/MM/DD HH:mm:ss Z');
                }
            } else if (typeof latest_action_from_user[0] === 'string') {
                user = BotClient.client.users.cache.get(latest_action_from_user[0]);
                date = moment(latest_action_from_user[1]).format('YYYY/MM/DD HH:mm:ss Z');
            } else {
                user = undefined;
                date = null;
            }
            if (user) {
                ui.addFields({ name: '\u00A0', value: '' });
                ui.setFooter({
                    iconURL: user ? user.displayAvatarURL() : undefined,
                    text: this.t('settings.execute.last_modified_by', {
                        user: user ? user.tag : this.t('settings.execute.unknown_user'),
                        date: date ? date : this.t('settings.execute.unknown_date'),
                    }),
                });
            }
        }

        if (interaction instanceof BaseInteraction) {
            const payload = {
                embeds: [ui],
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu).toJSON()],
            };

            if (interaction.isChatInputCommand()) {
                if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
                else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
            } else if (
                interaction.isStringSelectMenu() ||
                interaction.isChannelSelectMenu() ||
                interaction.isUserSelectMenu()
            ) {
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
