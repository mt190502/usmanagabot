import { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, Colors, EmbedBuilder, Message, StringSelectMenuBuilder, TextChannel, Webhook, WebhookClient } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Messages } from "../../types/database/messages";
import { Command_t } from "../../types/interface/commands";
import { Logger } from "../../utils/logger";

const settings = async (interaction: any) => {
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });
    let message_logger_status = guild.message_logger ? 'Disable' : 'Enable';
    const channel_select_menu = new ChannelSelectMenuBuilder().setCustomId('settings:logger:21').setPlaceholder('Select a channel').setChannelTypes(ChannelType.GuildText);

    const createMenuOptions = () => [
        { label: `${message_logger_status} Message Logger`, description: `${message_logger_status} the message logger`, value: 'settings:logger:1' },
        { label: 'Change Message Logger Channel', description: 'Change the channel where message logs are sent', value: 'settings:logger:2' },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    ];

    let menu = new StringSelectMenuBuilder().setCustomId('settings:logger:0').addOptions(...createMenuOptions());
    let row = new ActionRowBuilder().addComponents(menu);

    const menu_path = interaction.values ? (interaction.values[0].includes("settings:") ? interaction.values[0].split(':').at(-1) : interaction.customId.split(':').at(-1)) : interaction.customId.split(':').at(-1);
    switch (menu_path) {
        case '1':
            if (message_logger_status === 'Enable') {
                guild.message_logger = true;
                message_logger_status = 'Disable';
            } else {
                guild.message_logger = false;
                message_logger_status = 'Enable';
            }
            await DatabaseConnection.manager.save(guild);

            menu = new StringSelectMenuBuilder().setCustomId('settings:logger:0').addOptions(...createMenuOptions());
            row = new ActionRowBuilder().addComponents(menu);
            await interaction.update({
                content: `Message logger ${guild.message_logger ? 'enabled' : 'disabled'}`,
                components: [row]
            });
            break;
        case '2':
            await interaction.update({
                content: 'Select a channel',
                components: [new ActionRowBuilder().addComponents(channel_select_menu)]
            });
            break;
        case '21':
            if (interaction.values[0] != guild.message_logger_channel_id) {
                guild.message_logger_channel_id = interaction.values[0];
                if ((guild.message_logger_webhook_id !== null) && (guild.message_logger_webhook_token !== null)) {
                    const webhook_client = new WebhookClient({ id: guild.message_logger_webhook_id, token: guild.message_logger_webhook_token });
                    webhook_client.delete().then(() => {
                        Logger('info', `Deleted webhook ${guild.message_logger_webhook_id}`);
                    }).catch((error) => {
                        Logger('warn', `Error deleting webhook ${guild.message_logger_webhook_id}`);
                    });
                }

                const channel: TextChannel = await interaction.guild.channels.fetch(guild.message_logger_channel_id);
                await channel.createWebhook({ name: 'Message Logger' }).then((webhook: Webhook) => {
                    guild.message_logger_webhook_id = webhook.id;
                    guild.message_logger_webhook_token = webhook.token;

                    Logger('info', `Created webhook ${webhook.id} with name ${webhook.name}`);
                });
            } else {
                await interaction.update({ content: 'Old channel ID and New channel ID are the same', components: [row] });
                break;
            }

            await DatabaseConnection.manager.save(guild).then(() => {
                interaction.update({ content: `Message logger channel set to <#${guild.message_logger_channel_id}>`, components: [row] });
            }).catch((error) => {
                interaction.update({ content: 'Error setting message logger channel', components: [row] });
            });
            break;
        default:
            await interaction.update({
                content: 'Select a setting',
                components: [row]
            });
            break;
    }
}
const exec = async (event_name: string, message: Message, newMessage?: Message) => {
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: message.guild?.id } });
    const messageInDB = await DatabaseConnection.manager.findOne(Messages, { where: { message_id: BigInt(message.id) } });
    if (!messageInDB) {
        Logger('warn', 'Message not found in database');
        return;
    }
    const webhookClient = new WebhookClient({ id: guild.message_logger_webhook_id, token: guild.message_logger_webhook_token });
    let embed: EmbedBuilder;
    switch (event_name) {
        case 'messageCreate':
            let webhookMessageContent;
            let messageAttachments: string[];

            if (message.attachments.size > 0) messageAttachments = message.attachments.map((attachment) => attachment.url);
            if (message.reference?.messageId) {
                const referenceMessage = await DatabaseConnection.manager.findOne(Messages, { where: { message_id: BigInt(message.reference?.messageId) } });
                if (referenceMessage !== null) {
                    const url = `https://discord.com/channels/${referenceMessage.from_guild.gid}/${guild.message_logger_channel_id}/${referenceMessage.logged_message_id}`;
                    webhookMessageContent = message.url + ' | ' + `[Reply](${url})` + ' | ' + message.content;
                } else {
                    const url = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.reference?.messageId}`;
                    webhookMessageContent = message.url + ' | ' + `[Reply](${url})` + ' | ' + message.content;
                }
            } else {
                webhookMessageContent = message.url + ' | ' + message.content;
            }
            if (message.stickers.size > 0) {
                webhookMessageContent += "Stickers: " + message.stickers.map((sticker) => sticker.name).join(', ');
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

        case 'messageUpdate':
            let newMessageAttachments: string[];

            if (newMessage.attachments.size > 0) newMessageAttachments = newMessage.attachments.map((attachment) => attachment.url);

            embed = new EmbedBuilder().setTitle('Updated Message').setColor(Colors.Yellow).setTimestamp()
                .setDescription((newMessage.content != '' ? `**New Message:**\n${messageInDB.message}\n\n` : '') + (newMessageAttachments ? `**New Attachments:**\n${newMessageAttachments.join('\n')}` : ''))
            webhookClient.editMessage(messageInDB.logged_message_id.toString(), {
                embeds: [embed],
            });
            break;
        default:
            break;
        }
}

export default {
    enabled: true,
    name: 'logger',
    type: 'customizable',
    description: 'Message logger settings wrapper.',

    category: 'pseudo',
    cooldown: 0,
    usage: '/settings',
    usewithevent: ['messageCreate', 'messageDelete', 'messageUpdate'],

    pseudo_execute: exec,
    settings: settings,
} as Command_t;