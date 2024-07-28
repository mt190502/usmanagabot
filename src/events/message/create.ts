import { Events, Message } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Channels } from '../../types/database/channels';
import { Guilds } from '../../types/database/guilds';
import { Messages } from '../../types/database/messages';
import { Users } from '../../types/database/users';
import { Event_t } from '../../types/interface/events';


const exec = async (message: Message) => {
    if (message.author?.bot) return;

    let userInDB = await DatabaseConnection.manager.findOne(Users, { where: { uid: Number(message.author?.id) } });
    if (!userInDB) {
        const newUser = new Users();
        newUser.name = message.author?.username;
        newUser.uid = Number(message.author?.id);
        userInDB = await DatabaseConnection.manager.save(newUser);
    }

    let channelInDB = await DatabaseConnection.manager.findOne(Channels, { where: { cid: Number(message.channel.id) } });
    if (!channelInDB) {
        const newChannel = new Channels();
        newChannel.cid = Number(message.channel.id);
        channelInDB = await DatabaseConnection.manager.save(newChannel);
    }

    const newMessage = new Messages();
    newMessage.timestamp = new Date(message.createdTimestamp);
    newMessage.message = message.content;
    if (message.attachments.size > 0) newMessage.attachments = message.attachments.map((attachment) => attachment.url);
    newMessage.message_id = Number(message.id);
    newMessage.from_channel = channelInDB;
    newMessage.from_user = userInDB;
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
