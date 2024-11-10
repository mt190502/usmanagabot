import { Events, Message } from 'discord.js';
import { BotCommands, DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';

const exec = async (message: Message) => {
    if (message.author?.bot || !message.author?.id) return;
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: BigInt(message.guild?.id) } });

    const new_message = new Messages();
    new_message.timestamp = new Date(message.createdTimestamp);
    new_message.message_id = BigInt(message.id);
    new_message.from_channel = await CheckAndAddChannel(message.channel, message);
    new_message.from_user = await CheckAndAddUser(message.author, message);
    new_message.from_guild = guild;
    await DatabaseConnection.manager.save(new_message);

    for (const [, cmd_data] of BotCommands.get(BigInt(message.guild?.id)).concat(BotCommands.get(BigInt(0)))) {
        if (cmd_data.usewithevent?.includes('messageCreate')) {
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
