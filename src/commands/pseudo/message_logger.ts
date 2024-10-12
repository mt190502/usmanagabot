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
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { MessageLogger } from '../../types/database/logger';
import { Messages } from '../../types/database/messages';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const settings = async (interaction: StringSelectMenuInteraction) => {
    try {
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
                await DatabaseConnection.manager.save(logger);
                await interaction.update({
                    content: `Message logger ${logger.is_enabled ? 'enabled' : 'disabled'}`,
                    components: [genMenuOptions()],
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
                        const webhook_client = new WebhookClient({
                            id: logger.webhook_id,
                            token: logger.webhook_token,
                        });
                        await webhook_client.delete();
                    }

                    const channel: TextChannel = (await interaction.guild.channels.fetch(
                        logger.channel_id
                    )) as TextChannel;
                    const webhook = await channel.createWebhook({ name: 'Message Logger' });
                    logger.webhook_id = webhook.id;
                    logger.webhook_token = webhook.token;
                    Logger('info', `Created webhook ${webhook.id}`);
                } else {
                    await interaction.update({
                        content: 'Old channel ID and New channel ID are the same',
                        components: [genMenuOptions()],
                    });
                    break;
                }

                await DatabaseConnection.manager.save(logger);
                await interaction.update({
                    content: `Message logger channel set to <#${logger.channel_id}>`,
                    components: [genMenuOptions()],
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
                        components: [genMenuOptions()],
                    });
                    break;
                }
                logger.ignored_channels = ignored_channels.map((channel) => BigInt(channel.toString()));
                await DatabaseConnection.manager.save(logger);
                await interaction.update({
                    content: 'Ignored channels updated',
                    components: [genMenuOptions()],
                });
                break;
            }
            default:
                await interaction.update({
                    content: 'Select a setting',
                    components: [genMenuOptions()],
                });
                break;
        }
    } catch (error) {
        Logger('warn', error.message);
    }
};

const exec = async (event_name: string, message: Message, newMessage?: Message) => {
    try {
        const logger = await DatabaseConnection.manager.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(message.guild.id) } },
        });
        if (!logger || !logger.is_enabled || !logger.channel_id || !logger.webhook_id || !logger.webhook_token) return;

        if (logger.ignored_channels?.some((channel) => channel.toString() === message.channel.id)) return;

        const messageInDB = await DatabaseConnection.manager.findOne(Messages, {
            where: { message_id: BigInt(message.id) },
        });
        if (!messageInDB) return Logger('warn', 'Message not found in database');

        const webhookClient = new WebhookClient({ id: logger.webhook_id, token: logger.webhook_token });
        let embed: EmbedBuilder;

        switch (event_name) {
            case 'messageCreate': {
                let content = message.url;
                if (message.reference?.messageId) {
                    const referenceMessage = await DatabaseConnection.manager.findOne(Messages, {
                        where: { message_id: BigInt(message.reference.messageId) },
                    });
                    const url = referenceMessage
                        ? `https://discord.com/channels/${referenceMessage.from_guild.gid}/${logger.channel_id}/${referenceMessage.logged_message_id}`
                        : `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.reference.messageId}`;
                    content += ` | [Reply](${url})`;
                }
                content += ' | ' + message.content;
                if (message.stickers.size > 0) {
                    content += 'Stickers: ' + message.stickers.map((sticker) => sticker.name).join(', ');
                }
                if (message.attachments.size > 0) content += '\n' + message.attachments.map((a) => a.url).join('\n');

                const webhookMessage = await webhookClient.send({
                    content,
                    username: message.author.username,
                    avatarURL: message.author.displayAvatarURL(),
                    allowedMentions: { parse: [] },
                });

                messageInDB.logged_message_id = BigInt(webhookMessage.id);
                await DatabaseConnection.manager.save(messageInDB);
                break;
            }
            case 'messageDelete':
                embed = new EmbedBuilder().setTitle('Deleted Message').setColor(Colors.Red).setTimestamp();
                if (messageInDB?.logged_message_id) {
                    await webhookClient.editMessage(messageInDB.logged_message_id.toString(), { embeds: [embed] });
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
                if (messageInDB?.logged_message_id) {
                    await webhookClient.editMessage(messageInDB.logged_message_id.toString(), { embeds: [embed] });
                }
                break;
            }
        }
    } catch (error) {
        Logger('warn', error.message);
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
