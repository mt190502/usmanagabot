import { Events, Message } from 'discord.js';
import { BotCommands, DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';

const exec = async (message: Message) => {
    if (message.author?.bot || !message.author?.id) return;
    let messageAttachments: string[];
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: BigInt(message.guild?.id) } });
    if (message.attachments.size > 0) messageAttachments = message.attachments.map((attachment) => attachment.url);

    const newMessage = new Messages();
    newMessage.timestamp = new Date(message.createdTimestamp);
    newMessage.message = message.content;
    newMessage.message_id = BigInt(message.id);
    newMessage.from_channel = await CheckAndAddChannel(message, null);
    newMessage.from_user = await CheckAndAddUser(message, null);
    newMessage.from_guild = guild;
    await DatabaseConnection.manager.save(newMessage);

    for (const [cmd_name, cmd_data] of (BotCommands.get(BigInt(message.guild?.id)).concat(BotCommands.get(BigInt(0))))) {
        if ((cmd_data.usewithevent?.includes('messageCreate'))) {
            cmd_data.execute_when_event('messageCreate', message);
        }
    }
};

export default {
    enabled: true,
    once: false,
    name: 'messageCreate',
    data: Events.MessageCreate,
    execute: exec,
} as Event_t;
