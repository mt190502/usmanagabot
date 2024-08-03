import { Events, Message } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';

const exec = async (message: Message) => {
    if (message.author?.bot || !message.author?.id) return;

    const newMessage = new Messages();
    newMessage.timestamp = new Date(message.createdTimestamp);
    newMessage.message = message.content;
    if (message.attachments.size > 0) newMessage.attachments = message.attachments.map((attachment) => attachment.url);
    newMessage.message_id = BigInt(message.id);
    newMessage.from_channel = await CheckAndAddChannel(message, null);
    newMessage.from_user = await CheckAndAddUser(message, null);
    newMessage.from_guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: message.guild?.id } });
    await DatabaseConnection.manager.save(newMessage);
};

export default {
    enabled: true,
    once: false,
    name: 'messageCreate',
    data: Events.MessageCreate,
    execute: exec,
} as Event_t;
