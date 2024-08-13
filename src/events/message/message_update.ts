import { Colors, EmbedBuilder, Events, Message, WebhookClient } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Messages } from "../../types/database/messages";
import { Event_t } from "../../types/interface/events";
import { CheckAndAddChannel, CheckAndAddUser } from "../../utils/common";
import { Logger } from "../../utils/logger";

const exec = async (oldMessage: Message, newMessage: Message) => {
    if ((oldMessage.author?.bot && newMessage.author?.bot) || (!oldMessage.author?.id && newMessage.author?.id)) return;

    await CheckAndAddUser(oldMessage, null);
    await CheckAndAddChannel(oldMessage, null);

    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: oldMessage.guild?.id } });
    const oldMessageInDB = await DatabaseConnection.manager.findOne(Messages, { where: { message_id: BigInt(oldMessage.id) } });
    if (!oldMessageInDB) {
        Logger('warn', `Message ${oldMessage.id} not found in database`);
        return;
    }
    const webhookClient = new WebhookClient({ id: guild.message_logger_webhook_id, token: guild.message_logger_webhook_token });
 
    const embed = new EmbedBuilder().setTitle('Updated Message').setColor(Colors.Yellow).setTimestamp()
        .setDescription(`**New Message:**\n${newMessage.content}`);
    webhookClient.editMessage(oldMessageInDB.logged_message_id.toString(), {
        embeds: [embed],
    });
    

    oldMessageInDB.message_is_edited = true;
    oldMessageInDB.old_message = oldMessageInDB.message;
    oldMessageInDB.message = newMessage.content;

    if (newMessage.attachments.size === 0) {
        oldMessageInDB.attachments = null;
        oldMessageInDB.attachments_is_deleted = true;
    } else {
        oldMessageInDB.old_attachments = oldMessageInDB.attachments;
        oldMessageInDB.attachments = newMessage.attachments.map((attachment) => attachment.url);
        oldMessageInDB.attachments_is_edited = true;
    }
    await DatabaseConnection.manager.save(oldMessageInDB);
};

export default {
    enabled: true,
    once: false,
    name: 'messageUpdate',
    data: Events.MessageUpdate,
    execute: exec,
} as Event_t;
