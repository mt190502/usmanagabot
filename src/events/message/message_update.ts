import { Events, Message } from 'discord.js';
import { BotCommands, DatabaseConnection } from '../../main';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const exec = async (old_message: Message, new_message: Message) => {
    if ((old_message.author?.bot && new_message.author?.bot) || (!old_message.author?.id && new_message.author?.id)) {
        return;
    }

    await CheckAndAddUser(old_message.author, old_message);
    await CheckAndAddChannel(old_message.channel, old_message);

    const old_message_in_db = await DatabaseConnection.manager.findOne(Messages, {
        where: { message_id: BigInt(old_message.id) },
    });
    if (!old_message_in_db) {
        Logger('warn', `Message ${old_message.id} not found in database`);
        return;
    }

    old_message_in_db.message_is_edited = true;

    await DatabaseConnection.manager.save(old_message_in_db);

    for (const [, cmd_data] of BotCommands.get(BigInt(old_message.guild?.id)).concat(BotCommands.get(BigInt(0)))) {
        if (cmd_data.usewithevent?.includes('messageUpdate')) {
            cmd_data.execute_when_event('messageUpdate', old_message, new_message);
        }
    }
};

export default {
    enabled: true,
    once: false,
    name: 'messageUpdate',
    data: Events.MessageUpdate,
    execute: exec,
} as Event_t;
