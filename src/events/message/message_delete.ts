import { Events, Message } from 'discord.js';
import { BotCommands, DatabaseConnection } from '../../main';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const exec = async (message: Message) => {
    if (message.author?.bot || !message.author?.id) return;

    await CheckAndAddUser(message.author, message);
    await CheckAndAddChannel(message.channel, message);

    const message_in_database = await DatabaseConnection.manager.findOne(Messages, {
        where: { message_id: BigInt(message.id) },
    });
    if (!message_in_database) {
        Logger('warn', 'Message not found in database');
        return;
    }
    message_in_database.message_is_deleted = true;
    await DatabaseConnection.manager.save(message_in_database);

    for (const [, cmd_data] of BotCommands.get(BigInt(message.guild?.id)).concat(BotCommands.get(BigInt(0)))) {
        if (cmd_data.usewithevent?.includes('messageDelete')) {
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
