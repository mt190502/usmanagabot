import { Events, Message } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const exec = async (message: Message) => {
    if (message.author?.bot) return;
    
    await CheckAndAddUser(message);
    await CheckAndAddChannel(message);
    
    const msgInDB = await DatabaseConnection.manager.findOne(Messages, { where: { message_id: Number(message.id) } });
    if (!msgInDB) {
        Logger('info', 'Message not found in database');
        return;
    }
    msgInDB.message_is_deleted = true;
    await DatabaseConnection.manager.save(msgInDB);
};

export default {
    enabled: true,
    once: false,
    name: 'messageDelete',
    data: Events.MessageDelete,
    execute: exec,
} as Event_t;
