import {
    ChannelSelectMenuInteraction,
    ChannelType,
    Colors,
    EmbedBuilder,
    Events,
    Message,
    MessageType,
    StringSelectMenuInteraction,
    TextChannel,
    WebhookClient,
} from 'discord.js';
import { setTimeout } from 'timers/promises';
import { MessageLogger } from '../../types/database/entities/message_logger';
import { Messages } from '../../types/database/entities/messages';
import { ChainEvent } from '../../types/decorator/chainevent';
import { SettingChannelMenuComponent, SettingToggleButtonComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class MessageLoggerCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'messagelogger',
            pretty_name: 'Message Logger',
            description: 'Manage message logging settings for the server',
            cooldown: 10,
            is_admin_command: true,
            help: `
                Use this command to manage message logging settings for the server.

                **Usage:**
                - \`No Usage\`
            `,
        });
        this.base_cmd_data = null;
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let message_logger = await this.db.findOne(MessageLogger, { where: { from_guild: guild! } });
        if (!message_logger) {
            message_logger = new MessageLogger();
            message_logger.is_enabled = false;
            message_logger.from_guild = guild!;
            message_logger.latest_action_from_user = system_user!;
            message_logger = await this.db.save(MessageLogger, message_logger);
        }
        this.enabled = message_logger.is_enabled;
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    public async execute(message: Message): Promise<{ logger: MessageLogger; webhook: WebhookClient } | undefined> {
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

    @ChainEvent({ type: Events.MessageCreate })
    public async onMessageCreate(message: Message): Promise<void> {
        const pre_check_result = await this.execute(message);
        if (!pre_check_result) return;
        const { logger, webhook } = pre_check_result;

        let content = message.url;
        if (message.reference?.messageId) {
            const ref_message = await this.db.findOne(Messages, {
                where: { message_id: BigInt(message.reference.messageId) },
            });
            const url = ref_message
                ? `https://discord.com/channels/${ref_message.from_guild.gid}/${logger.channel_id}/${ref_message.logged_message_id}`
                : `https://discord.com/channels/${message.guild!.id}/${message.channel.id}/${message.reference.messageId}`;
            content += ` | [Reply](${url})`;
        }

        if (message.stickers.size > 0) {
            content += ' | Stickers: ' + message.stickers.map((sticker) => sticker.url).join('\n');
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
        return;
    }

    @ChainEvent({ type: Events.MessageDelete })
    public async onMessageDelete(message: Message): Promise<void> {
        const pre_check_result = await this.execute(message);
        if (!pre_check_result) return;
        const { webhook } = pre_check_result;
        await setTimeout(500);

        const db_message = await this.db.findOne(Messages, {
            where: { message_id: BigInt(message.id) },
        });
        const embed = new EmbedBuilder().setTitle('Deleted Message').setColor(Colors.Red).setTimestamp();
        if (db_message?.logged_message_id) {
            await webhook.editMessage(db_message.logged_message_id.toString(), { embeds: [embed] });
        }
    }

    @ChainEvent({ type: Events.MessageUpdate })
    public async onMessageUpdate(old_message: Message, new_message: Message): Promise<void> {
        const pre_check_result = await this.execute(old_message);
        if (!pre_check_result) return;
        const { webhook } = pre_check_result;
        await setTimeout(500);

        const embed = new EmbedBuilder()
            .setTitle('Updated Message')
            .setColor(Colors.Yellow)
            .setTimestamp()
            .setDescription(
                (new_message.content !== '' ? `**New Message:**\n${new_message.content}\n\n` : '') +
                    (new_message.attachments.size > 0
                        ? `**New Attachments:**\n${new_message.attachments.map((a) => a.url).join('\n')}`
                        : ''),
            );
        const db_message = await this.db.findOne(Messages, {
            where: { message_id: BigInt(old_message.id) },
        });
        if (db_message?.logged_message_id) {
            await webhook.editMessage(db_message.logged_message_id.toString(), { embeds: [embed] });
        }
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @SettingToggleButtonComponent({
        display_name: 'Enabled',
        database: MessageLogger,
        database_key: 'is_enabled',
        pretty: 'Toggle Message Logging',
        description: 'Toggle the message logging system enabled/disabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        const msg_logger = await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        msg_logger!.is_enabled = !msg_logger!.is_enabled;
        this.enabled = msg_logger!.is_enabled;
        await this.db.save(MessageLogger, msg_logger!);
        await this.settingsUI(interaction);
    }

    @SettingChannelMenuComponent({
        display_name: 'Log Channel',
        database: MessageLogger,
        database_key: 'channel_id',
        pretty: 'Set Log Channel',
        description: 'Set the channel where message logs will be sent.',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
            placeholder: 'Select a channel for message logs',
        },
    })
    public async setLogChannel(interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction): Promise<void> {
        const msg_logger = (await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        }))!;
        const selected_channel = interaction.values[0];
        msg_logger!.channel_id = selected_channel;
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
    }

    @SettingChannelMenuComponent({
        display_name: 'Ignored Channels',
        database: MessageLogger,
        database_key: 'ignored_channels',
        pretty: 'Manage Ignored Channels',
        description: 'Manage channels that are ignored by the message logging system.',
        format_specifier: '<#%s>',
        db_column_is_array: true,
        options: {
            channel_types: [ChannelType.GuildText],
            placeholder: 'Select channels to ignore from logging',
            min_values: 0,
            max_values: 25,
        },
    })
    public async manageIgnoredChannels(
        interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    ): Promise<void> {
        const msg_logger = await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        msg_logger!.ignored_channels = interaction.values.map((id) => BigInt(id));
        await this.db.save(MessageLogger, msg_logger!);
        await this.settingsUI(interaction);
    }
    // ================================================================ //
}
