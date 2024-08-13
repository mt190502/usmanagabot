import { Attachment, Events, Message, WebhookClient } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const exec = async (message: Message) => {
    if (message.author?.bot || !message.author?.id) return;
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: message.guild?.id } });
    const webhookClient = new WebhookClient({ id: guild.message_logger_webhook_id, token: guild.message_logger_webhook_token });
    const newMessage = new Messages();
    let messageAttachments: string[];
    let webhookMessageContent;
    
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
    if (message.attachments.size > 0) {
        webhookMessageContent += '\n' + messageAttachments.join('\n');
    }
    const webhookMessage = await webhookClient.send({
        content: webhookMessageContent,
        username: message.author.username,
        avatarURL: message.author.displayAvatarURL(),
    });
    
    newMessage.timestamp = new Date(message.createdTimestamp);
    newMessage.message = message.content;
    newMessage.attachments = messageAttachments;
    newMessage.message_id = BigInt(message.id);
    newMessage.logged_message_id = BigInt(webhookMessage.id);
    newMessage.from_channel = await CheckAndAddChannel(message, null);
    newMessage.from_user = await CheckAndAddUser(message, null);
    newMessage.from_guild = guild;
    await DatabaseConnection.manager.save(newMessage);
};

export default {
    enabled: true,
    once: false,
    name: 'messageCreate',
    data: Events.MessageCreate,
    execute: exec,
} as Event_t;
