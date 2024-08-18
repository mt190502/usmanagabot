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
    Webhook,
    WebhookClient,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { MessageLogger } from '../../types/database/logger';
import { Messages } from '../../types/database/messages';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const settings = async (interaction: StringSelectMenuInteraction) => {
    const logger = await DatabaseConnection.manager.findOne(MessageLogger, {
        where: { from_guild: { gid: BigInt(interaction.guild.id) } },
    });
    if (!logger) {
        const new_logger = new MessageLogger();
        new_logger.from_guild = await DatabaseConnection.manager.findOne(Guilds, {
            where: { gid: BigInt(interaction.guild.id) },
        });
        new_logger.latest_action_from_user = await DatabaseConnection.manager.findOne(Users, {
            where: { uid: BigInt(interaction.user.id) },
        });
        await DatabaseConnection.manager.save(new_logger);
        return settings(interaction);
    }
    let message_logger_status = logger.is_enabled ? 'Disable' : 'Enable';
    const channel_select_menu = new ChannelSelectMenuBuilder()
        .setPlaceholder('Select a channel')
        .setChannelTypes(ChannelType.GuildText);

    const createMenuOptions = () => [
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
        { label: 'Ignored Channels', description: 'Ignore channels from message logging', value: 'settings:logger:3' },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    ];

    let menu = new StringSelectMenuBuilder().setCustomId('settings:logger:0').addOptions(...createMenuOptions());
    let row = new ActionRowBuilder().addComponents(menu);

    const menu_path = interaction.values
        ? interaction.values[0].includes('settings:')
            ? interaction.values[0].split(':').at(-1)
            : interaction.customId.split(':').at(-1)
        : interaction.customId.split(':').at(-1);
    switch (menu_path) {
        case '1':
            if (message_logger_status === 'Enable') {
                logger.is_enabled = true;
                message_logger_status = 'Disable';
            } else {
                logger.is_enabled = false;
                message_logger_status = 'Enable';
            }
            await DatabaseConnection.manager.save(logger);

            menu = new StringSelectMenuBuilder().setCustomId('settings:logger:0').addOptions(...createMenuOptions());
            row = new ActionRowBuilder().addComponents(menu);
            await interaction.update({
                content: `Message logger ${logger.is_enabled ? 'enabled' : 'disabled'}`,
                components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
            });
            break;
        case '2':
            await interaction.update({
                content: 'Select a channel',
                components: [
                    new ActionRowBuilder()
                        .addComponents(channel_select_menu.setCustomId('settings:logger:21'))
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '21':
            if (interaction.values[0] != logger.channel_id) {
                logger.channel_id = interaction.values[0];
                if (logger.webhook_id !== null && logger.webhook_token !== null) {
                    const webhook_client = new WebhookClient({ id: logger.webhook_id, token: logger.webhook_token });
                    webhook_client
                        .delete()
                        .then(() => {
                            Logger('info', `Deleted webhook ${logger.webhook_id}`);
                        })
                        .catch((error: Error) => {
                            Logger('warn', `Error deleting webhook ${logger.webhook_id}: ${error.message}`);
                        });
                }

                const channel: TextChannel = (await interaction.guild.channels.fetch(logger.channel_id)) as TextChannel;
                await channel.createWebhook({ name: 'Message Logger' }).then((webhook: Webhook) => {
                    logger.webhook_id = webhook.id;
                    logger.webhook_token = webhook.token;

                    Logger('info', `Created webhook ${webhook.id} with name ${webhook.name}`);
                });
            } else {
                await interaction.update({
                    content: 'Old channel ID and New channel ID are the same',
                    components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                });
                break;
            }

            await DatabaseConnection.manager
                .save(logger)
                .then(() => {
                    interaction.update({
                        content: `Message logger channel set to <#${logger.channel_id}>`,
                        components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                    });
                })
                .catch((error: Error) => {
                    interaction.update({
                        content: 'Error setting message logger channel',
                        components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                    });
                    Logger('warn', error.message);
                    // TODO: Add syslog
                });
            break;
        case '3':
            await interaction.update({
                content: 'Select a channel to ignore',
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
        case '31': {
            const ignored_channels = interaction.values;
            if (ignored_channels.length === 0) {
                await interaction.update({
                    content: 'No channels selected',
                    components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                });
                break;
            }
            logger.ignored_channels = ignored_channels.map((channel) => BigInt(channel.toString()));
            await DatabaseConnection.manager
                .save(logger)
                .then(() => {
                    interaction.update({
                        content: 'Ignored channels updated',
                        components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                    });
                })
                .catch((error: Error) => {
                    interaction.update({
                        content: 'Error updating ignored channels',
                        components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                    });
                    Logger('warn', error.message);
                    // TODO: Add syslog
                });
            break;
        }
        default:
            await interaction.update({
                content: 'Select a setting',
                components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
            });
            break;
    }
};
const exec = async (event_name: string, message: Message, newMessage?: Message) => {
    const logger = await DatabaseConnection.manager.findOne(MessageLogger, {
        where: { from_guild: { gid: BigInt(message.guild.id) } },
    });
    if (
        !logger ||
        logger.is_enabled === false ||
        logger.channel_id === null ||
        logger.webhook_id === null ||
        logger.webhook_token === null
    ) {
        return;
    }

    if (logger.ignored_channels) {
        for (const channel of logger.ignored_channels) {
            if (channel.toString() === message.channel.id) return;
        }
    }

    const messageInDB = await DatabaseConnection.manager.findOne(Messages, {
        where: { message_id: BigInt(message.id) },
    });
    if (!messageInDB) {
        Logger('warn', 'Message not found in database');
        return;
    }
    const webhookClient = new WebhookClient({ id: logger.webhook_id, token: logger.webhook_token });
    let embed: EmbedBuilder;
    switch (event_name) {
        case 'messageCreate': {
            let webhookMessageContent;
            let messageAttachments: string[];
            if (message.attachments.size > 0) {
                messageAttachments = message.attachments.map((attachment) => attachment.url);
            }
            if (message.reference?.messageId) {
                const referenceMessage = await DatabaseConnection.manager.findOne(Messages, {
                    where: { message_id: BigInt(message.reference?.messageId) },
                });
                if (referenceMessage !== null) {
                    const url = `https://discord.com/channels/${referenceMessage.from_guild.gid}/${logger.channel_id}/${referenceMessage.logged_message_id}`;
                    webhookMessageContent = message.url + ' | ' + `[Reply](${url})` + ' | ' + message.content;
                } else {
                    const url = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.reference?.messageId}`;
                    webhookMessageContent = message.url + ' | ' + `[Reply](${url})` + ' | ' + message.content;
                }
            } else {
                webhookMessageContent = message.url + ' | ' + message.content;
            }
            if (message.stickers.size > 0) {
                webhookMessageContent += 'Stickers: ' + message.stickers.map((sticker) => sticker.name).join(', ');
            }
            if (message.attachments.size > 0) {
                webhookMessageContent += '\n' + messageAttachments.join('\n');
            }
            const webhookMessage = await webhookClient.send({
                content: webhookMessageContent,
                username: message.author.username,
                avatarURL: message.author.displayAvatarURL(),
                allowedMentions: { parse: [] },
            });

            messageInDB.logged_message_id = BigInt(webhookMessage.id);
            await DatabaseConnection.manager.save(messageInDB);
            break;
        }
        case 'messageDelete':
            if (!messageInDB) {
                Logger('warn', 'Message not found in database');
                return;
            }
            embed = new EmbedBuilder().setTitle('Deleted Message').setColor(Colors.Red).setTimestamp();
            webhookClient.editMessage(messageInDB.logged_message_id.toString(), {
                embeds: [embed],
            });
            break;

        case 'messageUpdate': {
            let newMessageAttachments: string[];

            if (newMessage.attachments.size > 0) {
                newMessageAttachments = newMessage.attachments.map((attachment) => attachment.url);
            }

            embed = new EmbedBuilder()
                .setTitle('Updated Message')
                .setColor(Colors.Yellow)
                .setTimestamp()
                .setDescription(
                    (newMessage.content != '' ? `**New Message:**\n${messageInDB.message}\n\n` : '') +
                        (newMessageAttachments ? `**New Attachments:**\n${newMessageAttachments.join('\n')}` : '')
                );
            if (messageInDB.logged_message_id) {
                webhookClient.editMessage(messageInDB.logged_message_id.toString(), { embeds: [embed] });
            }
            break;
        }
        default:
            break;
    }
};

export default {
    enabled: true,
    name: 'logger',
    type: 'customizable',
    description: 'Message logger settings wrapper.',

    category: 'pseudo',
    cooldown: 0,
    usage: '/settings',
    usewithevent: ['messageCreate', 'messageDelete', 'messageUpdate'],

    execute_when_event: exec,
    settings: settings,
} as Command_t;
