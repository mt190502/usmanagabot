import { Events, Message } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Messages } from '../../types/database/messages';
import { Users } from '../../types/database/users';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

const exec = async (message: Message) => {
    if (message.author?.bot) return;
    let userInDB = await DatabaseConnection.manager.findOne(Users, { where: { uid: Number(message.author?.id) } });
    if (!userInDB) {
        const newUser = new Users();
        newUser.name = message.author?.username;
        newUser.uid = Number(message.author?.id);
        userInDB = await DatabaseConnection.manager.save(newUser);
    }
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
