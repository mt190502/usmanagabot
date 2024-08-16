import { Events, Message } from 'discord.js';
import { BotCommands, DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const exec = async (message: Message) => {
    if (message.author?.bot || !message.author?.id) return;

    await CheckAndAddUser(message, null);
    await CheckAndAddChannel(message, null);

    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: message.guild?.id } });
    const messageInDB = await DatabaseConnection.manager.findOne(Messages, { where: { message_id: BigInt(message.id) } })
    if (!messageInDB) {
        Logger('warn', 'Message not found in database');
        return;
    }
    messageInDB.message_is_deleted = true;
    await DatabaseConnection.manager.save(messageInDB);

    for (const cmd_data of BotCommands.get(BigInt(message.guild?.id)).values()) {
        if ((cmd_data.usewithevent?.includes('messageDelete'))) {
            cmd_data.execute_when_event('messageDelete', message);
        }
    }
};

export default {
    enabled: true,
    once: false,
    name: 'messageDelete',
    data: Events.MessageDelete,
    execute: exec,
} as Event_t;
