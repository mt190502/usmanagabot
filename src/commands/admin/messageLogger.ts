import {
    ApplicationCommandType,
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    Colors,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    EmbedBuilder,
    Events,
    Message,
    MessageFlags,
    MessageType,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    WebhookClient,
} from 'discord.js';
import { setTimeout } from 'timers/promises';
import { CommandLoader } from '..';
import { MessageLogger } from '../../types/database/entities/message_logger';
import { Messages } from '../../types/database/entities/messages';
import { ChainEvent } from '../../types/decorator/chainevent';
import { Log } from '../../types/decorator/log';
import { SettingChannelMenuComponent, SettingGenericSettingComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

/**
 * A comprehensive message logging and tracking command.
 *
 * This command automatically logs message creation, deletion, and updates to a designated channel
 * via a webhook. It also provides a command interface to retrieve the logged location of a specific message.
 *
 * Features:
 * - Listens for `MessageCreate`, `MessageDelete`, and `MessageUpdate` events.
 * - Logs message content, attachments, and replies to a webhook.
 * - Marks deleted or edited messages in the log channel.
 * - Supports both a slash command and a context menu command to find a logged message.
 * - Fully configurable settings per guild, including enabling/disabling, setting the log channel, and ignoring specific channels.
 */
export default class MessageLoggerCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'message_logger', is_admin_command: true });

        (this.base_cmd_data as SlashCommandBuilder)
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addStringOption((option) =>
                option.setName('message_id').setDescription(this.t('parameters.message_id')!).setRequired(true),
            ) as SlashCommandBuilder;
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setNameLocalizations(this.getLocalizations('pretty_name'))
            .setType(ApplicationCommandType.Message)
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let message_logger = await this.db.findOne(MessageLogger, { where: { from_guild: guild! } });
        if (!message_logger) {
            message_logger = new MessageLogger();
            message_logger.is_enabled = false;
            message_logger.from_guild = guild!;
            message_logger.latest_action_from_user = system_user!;
            message_logger = await this.db.save(MessageLogger, message_logger);
            this.log.send('log', 'command.prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = message_logger.is_enabled;
        this.log.send('debug', 'command.prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * Executes the command to find a logged message.
     *
     * This method is triggered by either the slash command (using a message ID/URL) or the
     * message context menu. It searches the database for the original message's record
     * and replies with a link to the corresponding logged message in the webhook channel.
     *
     * @param interaction The interaction from the slash command or context menu.
     */
    @Log()
    public async execute(interaction: ContextMenuCommandInteraction | ChatInputCommandInteraction): Promise<void> {
        const logger = (await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guild!.id) } },
        }))!;

        const post = new EmbedBuilder();

        let message_id = '';
        if (interaction.isContextMenuCommand()) {
            message_id = interaction.targetId;
        } else if (interaction.isChatInputCommand()) {
            const input = interaction.options.getString('message_id')!;
            if (input.match(/^https?:\/\/(canary\.|ptb\.)?discord(app)?\.com\/channels\/\d+\/\d+\/\d+$/)) {
                message_id = input.split('/').pop()!;
            } else if (input.match(/^\d+$/)) {
                message_id = input;
            } else {
                post.setColor(Colors.Yellow)
                    .setTitle(`:warning: ${this.t('execute.invalid_input', undefined, interaction)}`)
                    .setDescription(this.t('execute.invalid_input_description', { input }, interaction)!);
                await interaction.reply({
                    embeds: [post],
                    flags: MessageFlags.Ephemeral,
                });
                this.log.send('warn', 'command.messagelogger.execute.invalid_input', {
                    guild: interaction.guild,
                    user: interaction.user,
                    input: input,
                });
                return;
            }
        }

        const message_in_logger = (await this.db.findOne(Messages, { where: { message_id: BigInt(message_id) } }))
            ?.logged_message_id;

        if (!message_in_logger) {
            post.setColor(Colors.Yellow)
                .setTitle(`:warning: ${this.t('execute.message_not_found', undefined, interaction)}`)
                .setDescription(this.t('execute.message_not_found_description', { message_id }, interaction)!);
            await interaction.reply({
                embeds: [post],
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.messagelogger.execute.message_not_found', {
                guild: interaction.guild,
                user: interaction.user,
                message_id: message_id,
            });
            return;
        }

        post.setColor(Colors.Green)
            .setTitle(`:mag: ${this.t('execute.message_found', undefined, interaction)}`)
            .setDescription(
                this.t(
                    'execute.message_found_description',
                    {
                        message_id,
                        guild_id: logger.from_guild.gid,
                        channel_id: logger.channel_id,
                        message_in_logger,
                    },
                    interaction,
                )!,
            );
        await interaction.reply({
            embeds: [post],
            flags: MessageFlags.Ephemeral,
        });
    }

    /**
     * Performs preliminary checks for message-related events.
     *
     * This helper method verifies several conditions before processing an event:
     * - The message is from a guild and not from a bot.
     * - The message logger is enabled for the guild.
     * - A valid log channel and webhook are configured.
     * - The message's channel is not in the ignored list.
     * - The message type is a standard or reply message.
     *
     * If all checks pass, it returns the logger configuration and an initialized webhook client.
     *
     * @param message The message that triggered the event.
     * @returns A promise that resolves with the logger and webhook client, or `undefined` if any check fails.
     */
    @Log()
    public async preCheck(
        message: Message<true>,
    ): Promise<{ logger: MessageLogger; webhook: WebhookClient } | undefined> {
        if (!message.guild || message?.author?.bot) return;
        const logger = await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(message.guild.id) } },
        });

        if (!logger || !logger.is_enabled || !logger.channel_id || !logger.webhook_id || !logger.webhook_token) {
            return;
        }
        if (logger.ignored_channels?.some((channel) => channel.toString() === message.channel.id)) return;
        if (![MessageType.Default, MessageType.Reply].includes(message.type)) return;

        const webhook = new WebhookClient({ id: logger.webhook_id, token: logger.webhook_token });
        await setTimeout(500);
        return { logger, webhook };
    }

    /**
     * Event handler for `messageCreate`.
     *
     * Logs a newly created message to the designated webhook channel. It includes the message URL,
     * content, attachments, stickers, and a link to the replied message, if any. The content is
     * split into multiple webhook messages if it exceeds the character limit. The ID of the final
     * webhook message is stored in the database against the original message.
     *
     * @param message The message that was created.
     */
    @ChainEvent({ type: Events.MessageCreate })
    @Log()
    public async onMessageCreate(message: Message<true>): Promise<void> {
        const pre_check_result = await this.preCheck(message);
        if (!pre_check_result) return;
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'messagelogger',
            event: 'MessageCreate',
            guild: message.guild,
            author: message.author,
        });
        const { logger, webhook } = pre_check_result;

        let content = message.url;
        if (message.reference?.messageId) {
            const ref_message = await this.db.findOne(Messages, {
                where: { message_id: BigInt(message.reference.messageId) },
            });
            const url = ref_message
                ? `https://discord.com/channels/${ref_message.from_guild.gid}/${logger.channel_id}/${ref_message.logged_message_id}`
                : `https://discord.com/channels/${message.guild!.id}/${message.channel.id}/${message.reference.messageId}`;
            content += ` | [${this.t('events.onmessagecreate.reply', undefined, message)}](${url})`;
        }

        if (message.stickers.size > 0) {
            content +=
                ` | ${this.t('events.onmessagecreate.stickers', undefined, message)}: ` +
                message.stickers.map((sticker) => sticker.url).join('\n');
            content += '\n';
        }

        const contents: string[] = [];
        if (message.content.length > 0 && message.content.length < 1800) {
            content += ' | ' + message.content;
            contents.push(content);
        } else {
            let spliced_content = content + ' | ' + message.content;
            while (spliced_content.length > 1800) {
                contents.push(spliced_content.slice(0, 1800));
                spliced_content = spliced_content.slice(1800);
            }
            contents.push(spliced_content);
        }

        let webhook_msg_id: string;
        for (const index in contents) {
            const webhook_message = await webhook.send({
                content: contents[index],
                username: message.author.username,
                avatarURL: message.author.displayAvatarURL(),
                allowedMentions: { parse: [] },
                files: message.attachments.map((a) => a.url),
            });
            if (parseInt(index) === contents.length - 1) {
                webhook_msg_id = webhook_message.id;
            }
        }

        const db_message = (await this.db.findOne(Messages, {
            where: { message_id: BigInt(message.id) },
        }))!;
        db_message.logged_message_id = BigInt(webhook_msg_id!);
        await this.db.save(Messages, db_message);
        this.log.send('debug', 'command.event.trigger.success', {
            name: 'messagelogger',
            event: 'MessageCreate',
            guild: message.guild,
            author: message.author,
        });
        return;
    }

    /**
     * Event handler for `messageDelete`.
     *
     * When a message is deleted, this finds the corresponding logged message via the database
     * and edits it to include an embed indicating that the original message was deleted.
     *
     * @param message The message that was deleted.
     */
    @ChainEvent({ type: Events.MessageDelete })
    @Log()
    public async onMessageDelete(message: Message<true>): Promise<void> {
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'messagelogger',
            event: 'MessageDelete',
            guild: message.guild,
            user: message.author,
        });
        const pre_check_result = await this.preCheck(message);
        if (!pre_check_result) return;
        const { webhook } = pre_check_result;
        await setTimeout(500);

        const db_message = await this.db.findOne(Messages, {
            where: { message_id: BigInt(message.id) },
        });
        const embed = new EmbedBuilder()
            .setTitle(this.t('events.onmessagedelete.deleted_message', undefined, message))
            .setColor(Colors.Red)
            .setTimestamp();
        if (db_message?.logged_message_id) {
            await webhook.editMessage(db_message.logged_message_id.toString(), { embeds: [embed] });
        }
        this.log.send('debug', 'command.event.trigger.success', {
            name: 'messagelogger',
            event: 'MessageDelete',
            guild: message.guild,
            author: message.author,
        });
    }

    /**
     * Event handler for `messageUpdate`.
     *
     * When a message is edited, this finds the corresponding logged message and edits it to
     * include an embed showing the new content and/or attachments, indicating that the
     * original message was updated.
     *
     * @param old_message The message before the update.
     * @param new_message The message after the update.
     */
    @ChainEvent({ type: Events.MessageUpdate })
    @Log()
    public async onMessageUpdate(old_message: Message<true>, new_message: Message<true>): Promise<void> {
        if (new_message.author?.bot) return;
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'messagelogger',
            event: 'MessageUpdate',
            guild: old_message.guild,
            author: old_message.author,
        });
        const pre_check_result = await this.preCheck(old_message);
        if (!pre_check_result) return;
        const { webhook } = pre_check_result;
        await setTimeout(500);

        const embed = new EmbedBuilder()
            .setTitle(this.t('events.onmessageupdate.updated_message', undefined, new_message))
            .setColor(Colors.Yellow)
            .setTimestamp()
            .setDescription(
                (new_message.content !== ''
                    ? `**${this.t('events.onmessageupdate.new_message', undefined, new_message)}:**\n${new_message.content}\n\n`
                    : '') +
                    (new_message.attachments.size > 0
                        ? `**${this.t('events.onmessageupdate.new_attachments', undefined, new_message)}:**\n${new_message.attachments.map((a) => a.url).join('\n')}`
                        : ''),
            );
        const db_message = await this.db.findOne(Messages, {
            where: { message_id: BigInt(old_message.id) },
        });
        if (db_message?.logged_message_id) {
            await webhook.editMessage(db_message.logged_message_id.toString(), { embeds: [embed] });
        }
        this.log.send('debug', 'command.event.trigger.success', {
            name: 'messagelogger',
            event: 'MessageUpdate',
            guild: old_message.guild,
            author: old_message.author,
        });
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    /**
     * Toggles the message logger on or off for the guild.
     *
     * This method is a setting component that responds to a select menu interaction.
     * It flips the `is_enabled` boolean in the database and reloads the command on Discord
     * to reflect the new state.
     *
     * @param interaction The interaction from the settings UI.
     */
    @SettingGenericSettingComponent({
        database: MessageLogger,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    @Log()
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
        const msg_logger = await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        msg_logger!.is_enabled = !msg_logger!.is_enabled;
        msg_logger!.latest_action_from_user = user;
        msg_logger!.timestamp = new Date();
        this.enabled = msg_logger!.is_enabled;
        await this.db.save(MessageLogger, msg_logger!);
        CommandLoader.RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    /**
     * Sets the channel where messages will be logged.
     *
     * This method is a setting component that responds to a channel select menu.
     * It updates the `channel_id` in the database, deletes any old webhook associated
     * with the previous channel, and creates a new webhook in the selected channel.
     *
     * @param interaction The interaction from the settings UI.
     */
    @SettingChannelMenuComponent({
        database: MessageLogger,
        database_key: 'channel_id',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
        },
    })
    @Log()
    public async setLogChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.channel.start', { name: this.name, guild: interaction.guild });
        const msg_logger = (await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        }))!;
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const selected_channel = interaction.values[0];
        msg_logger!.channel_id = selected_channel;
        msg_logger!.latest_action_from_user = user;
        msg_logger!.timestamp = new Date();
        if (msg_logger.webhook_id !== null && msg_logger.webhook_token !== null) {
            const webhook_client = new WebhookClient({
                id: msg_logger.webhook_id,
                token: msg_logger.webhook_token,
            });
            await webhook_client.delete();
        }

        const channel = (await interaction.guild!.channels.fetch(msg_logger.channel_id)) as TextChannel;
        const webhook = await channel.createWebhook({ name: 'Message Logger' });
        msg_logger.webhook_id = webhook.id;
        msg_logger.webhook_token = webhook.token;
        await this.db.save(MessageLogger, msg_logger!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.channel.success', {
            name: this.name,
            guild: interaction.guild,
            channel: selected_channel,
        });
    }

    /**
     * Manages the list of channels to be ignored by the logger.
     *
     * This method is a setting component that responds to a multi-select channel menu.
     * It updates the `ignored_channels` array in the database with the user's selection.
     * Messages from these channels will not be logged.
     *
     * @param interaction The interaction from the settings UI.
     */
    @SettingChannelMenuComponent({
        database: MessageLogger,
        database_key: 'ignored_channels',
        format_specifier: '<#%s>',
        db_column_is_array: true,
        options: {
            channel_types: [ChannelType.GuildText],
            min_values: 0,
            max_values: 25,
        },
    })
    @Log()
    public async manageIgnoredChannels(interaction: ChannelSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.channel.start', { name: this.name, guild: interaction.guild });
        const msg_logger = await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        msg_logger!.ignored_channels = interaction.values.map((id) => BigInt(id));
        msg_logger!.latest_action_from_user = user;
        msg_logger!.timestamp = new Date();
        await this.db.save(MessageLogger, msg_logger!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.channel.success', {
            name: this.name,
            guild: interaction.guild,
            channel: interaction.values.join(', '),
        });
    }
    // ================================================================ //
}
