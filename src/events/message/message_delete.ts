import { Colors, EmbedBuilder, Events, Message, WebhookClient } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Messages } from '../../types/database/messages';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';
import { Guilds } from '../../types/database/guilds';

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
    const webhookClient = new WebhookClient({ id: guild.message_logger_webhook_id, token: guild.message_logger_webhook_token });
 
    const embed = new EmbedBuilder().setTitle('Deleted Message').setColor(Colors.Red).setTimestamp();
    webhookClient.editMessage(messageInDB.logged_message_id.toString(), {
        embeds: [embed],
    });

    messageInDB.message_is_deleted = true;
    await DatabaseConnection.manager.save(messageInDB);
};

export default {
    enabled: true,
    once: false,
    name: 'messageDelete',
    data: Events.MessageDelete,
    execute: exec,
} as Event_t;
