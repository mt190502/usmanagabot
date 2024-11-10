import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChannelSelectMenuBuilder,
    ChannelType,
    Colors,
    EmbedBuilder,
    Message,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    WebhookClient,
} from 'discord.js';
import timers from 'node:timers/promises';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { MessageLogger } from '../../types/database/message_logger';
import { Messages } from '../../types/database/messages';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const settings = async (interaction: StringSelectMenuInteraction) => {
    const logger = await DatabaseConnection.manager
        .findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    if (!logger) {
        const new_logger = new MessageLogger();
        new_logger.from_guild = await DatabaseConnection.manager
            .findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        new_logger.latest_action_from_user = await DatabaseConnection.manager
            .findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        await DatabaseConnection.manager.save(new_logger).catch((err) => {
            Logger('error', err, interaction);
        });
        return settings(interaction);
    }

    let message_logger_status = logger.is_enabled ? 'Disable' : 'Enable';
    const channel_select_menu = new ChannelSelectMenuBuilder()
        .setPlaceholder('Select a channel')
        .setChannelTypes(ChannelType.GuildText);

    const genPostEmbed = (warn?: string): EmbedBuilder => {
        const post = new EmbedBuilder().setTitle(':gear: Message Logger Settings');
        const fields: { name: string; value: string }[] = [];

        if (warn) {
            post.setColor(Colors.Yellow);
            fields.push({ name: ':warning: Warning', value: warn });
        } else {
            post.setColor(Colors.Blue);
        }

        fields.push(
            {
                name: 'Enabled',
                value: logger.is_enabled ? ':green_circle: True' : ':red_circle: False',
            },
            {
                name: 'Channel',
                value: logger.channel_id ? `<#${logger.channel_id}>` : 'Not set',
            },
            {
                name: 'Ignored Channels',
                value:
                    logger.ignored_channels?.length > 0
                        ? logger.ignored_channels.map((channel) => `<#${channel}>`).join(', ')
                        : 'None',
            },
            {
                name: 'Webhook',
                value: logger.webhook_id ? ':green_circle: Active' : ':red_circle: Inactive',
            },
            {
                name: 'Webhook ID',
                value: logger.webhook_id || 'Not set',
            }
        );

        post.addFields(fields);
        return post;
    };

    const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
        const menu = new StringSelectMenuBuilder().setCustomId('settings:logger:0').addOptions([
            {
                label: `${message_logger_status} Message Logger`,
                description: `${message_logger_status} the message logger`,
                value: 'settings:logger:1',
            },
            {
                label: 'Change Message Logger Channel',
                description: 'Change the channel where message logs are sent',
                value: 'settings:logger:2',
            },
            {
                label: 'Ignored Channels',
                description: 'Ignore channels from message logging',
                value: 'settings:logger:3',
            },
            { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
        ]);

        return new ActionRowBuilder()
            .addComponents(menu)
            .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>;
    };

    const menu_path = interaction.values
        ? interaction.values[0].includes('settings:')
            ? interaction.values[0].split(':').at(-1)
            : interaction.customId.split(':').at(-1)
        : interaction.customId.split(':').at(-1);

    switch (menu_path) {
        case '1':
            logger.is_enabled = !logger.is_enabled;
            message_logger_status = logger.is_enabled ? 'Disable' : 'Enable';
            await DatabaseConnection.manager.save(logger).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        case '2':
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [
                    new ActionRowBuilder()
                        .addComponents(channel_select_menu.setCustomId('settings:logger:21'))
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '3':
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            channel_select_menu
                                .setCustomId('settings:logger:31')
                                .setMinValues(1)
                                .setMaxValues(10)
                                .setDefaultChannels(
                                    logger.ignored_channels?.length > 0
                                        ? logger.ignored_channels.map((channel) => channel.toString())
                                        : []
                                )
                        )
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '21':
            if (interaction.values[0] != logger.channel_id) {
                logger.channel_id = interaction.values[0];
                if (logger.webhook_id !== null && logger.webhook_token !== null) {
                    const webhook_client = new WebhookClient({
                        id: logger.webhook_id,
                        token: logger.webhook_token,
                    });
                    await webhook_client.delete().catch((err) => {
                        Logger('error', err, interaction);
                    });
                }

                const channel: TextChannel = (await interaction.guild.channels.fetch(logger.channel_id)) as TextChannel;
                const webhook = await channel.createWebhook({ name: 'Message Logger' }).catch((err) => {
                    Logger('error', err, interaction);
                    throw err;
                });
                logger.webhook_id = webhook.id;
                logger.webhook_token = webhook.token;
                Logger('info', `Created webhook ${webhook.id}`);
            } else {
                await interaction.update({
                    embeds: [genPostEmbed('Channel is already set')],
                    components: [genMenuOptions()],
                });
                break;
            }

            await DatabaseConnection.manager.save(logger).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        case '31': {
            const ignored_channels = interaction.values;
            if (ignored_channels.length === 0) {
                await interaction.update({
                    embeds: [genPostEmbed('Please select at least one channel')],
                    components: [genMenuOptions()],
                });
                break;
            }
            logger.ignored_channels = ignored_channels.map((channel) => BigInt(channel.toString()));
            await DatabaseConnection.manager.save(logger).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        }
        default:
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
    }
};

const exec = async (event_name: string, message: Message, newMessage?: Message) => {
    const logger = await DatabaseConnection.manager
        .findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(message.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, message);
            throw err;
        });
    if (!logger || !logger.is_enabled || !logger.channel_id || !logger.webhook_id || !logger.webhook_token) return;

    if (logger.ignored_channels?.some((channel) => channel.toString() === message.channel.id)) return;

    const message_in_database = await DatabaseConnection.manager
        .findOne(Messages, {
            where: { message_id: BigInt(message.id) },
        })
        .catch((err) => {
            Logger('error', err, message);
            throw err;
        });
    if (!message_in_database) return Logger('warn', 'Message not found in database');

    const webhook_client = new WebhookClient({ id: logger.webhook_id, token: logger.webhook_token });
    let embed: EmbedBuilder;

    switch (event_name) {
        case 'messageCreate': {
            let content = message.url;
            if (message.reference?.messageId) {
                const ref_message = await DatabaseConnection.manager
                    .findOne(Messages, {
                        where: { message_id: BigInt(message.reference.messageId) },
                    })
                    .catch((err) => {
                        Logger('error', err, message);
                    });
                const url = ref_message
                    ? `https://discord.com/channels/${ref_message.from_guild.gid}/${logger.channel_id}/${ref_message.logged_message_id}`
                    : `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.reference.messageId}`;
                content += ` | [Reply](${url})`;
            }

            const contents: string[] = [];
            if (message.content.length == 0 && message.system) {
                content += ' | Member joined';
                contents.push(content);
            } else if (message.content.length < 1800) {
                content += ' | ' + message.content;
                contents.push(message.content);
            } else if (message.content.length > 1800 && message.content.length < 3600) {
                content += ' | ' + message.content.slice(0, 1800) + '...';
                contents.push(content);
                contents.push(message.content.slice(1800));
            } else {
                content += ' | ' + message.content.slice(0, 1800) + '...';
                contents.push(content);
                content = message.content.slice(1800, 3600);
                contents.push(content);
                content = message.content.slice(3600);
                contents.push(content);
            }
            if (message.stickers.size > 0) {
                content += 'Stickers: ' + message.stickers.map((sticker) => sticker.name).join(', ');
            }
            if (message.attachments.size > 0) content += '\n' + message.attachments.map((a) => a.url).join('\n');

            let webhook_msg_id: string;
            for (const c in contents) {
                timers.setTimeout(500);
                const webhook_message = await webhook_client
                    .send({
                        content: contents[c],
                        username: message.author.username,
                        avatarURL: message.author.displayAvatarURL(),
                        allowedMentions: { parse: [] },
                    })
                    .catch((err) => {
                        Logger('error', err, message);
                        throw err;
                    });
                if (parseInt(c) == contents.length - 1) {
                    webhook_msg_id = webhook_message.id;
                }
            }

            message_in_database.logged_message_id = BigInt(webhook_msg_id);
            await DatabaseConnection.manager.save(message_in_database).catch((err) => {
                Logger('error', err, message);
            });
            break;
        }
        case 'messageDelete':
            embed = new EmbedBuilder().setTitle('Deleted Message').setColor(Colors.Red).setTimestamp();
            if (message_in_database?.logged_message_id) {
                await webhook_client
                    .editMessage(message_in_database.logged_message_id.toString(), { embeds: [embed] })
                    .catch((err) => {
                        Logger('error', err, message);
                    });
            }
            break;
        case 'messageUpdate': {
            embed = new EmbedBuilder()
                .setTitle('Updated Message')
                .setColor(Colors.Yellow)
                .setTimestamp()
                .setDescription(
                    (newMessage.content !== '' ? `**New Message:**\n${newMessage.content}\n\n` : '') +
                        (newMessage.attachments.size > 0
                            ? `**New Attachments:**\n${newMessage.attachments.map((a) => a.url).join('\n')}`
                            : '')
                );
            if (message_in_database?.logged_message_id) {
                await webhook_client
                    .editMessage(message_in_database.logged_message_id.toString(), { embeds: [embed] })
                    .catch((err) => {
                        Logger('error', err, message);
                    });
            }
            break;
        }
    }
};

export default {
    enabled: true,
    name: 'logger',
    type: 'customizable',
    description: 'Message logger settings wrapper.',

    category: 'pseudo',
    cooldown: 0,
    usewithevent: ['messageCreate', 'messageDelete', 'messageUpdate'],

    execute_when_event: exec,
    settings: settings,
} as Command_t;
