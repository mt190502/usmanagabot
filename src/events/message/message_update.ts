import { Events, Message } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Messages } from "../../types/database/messages";
import { Event_t } from "../../types/interface/events";
import { CheckAndAddChannel, CheckAndAddUser } from "../../utils/common";
import { Logger } from "../../utils/logger";

const exec = async (oldMessage: Message, newMessage: Message) => {
    if (oldMessage.author?.bot && newMessage.author?.bot && !oldMessage.id && !newMessage.id) return;

    await CheckAndAddUser(oldMessage, null);
    await CheckAndAddChannel(oldMessage, null);

    const oldMsgInDB = await DatabaseConnection.manager.findOne(Messages, { where: { message_id: Number(oldMessage.id) } });
    if (!oldMsgInDB) {
        Logger('warn', `Message ${oldMessage.id} not found in database`);
        return;
    }
    oldMsgInDB.message_is_edited = true;
    oldMsgInDB.old_message = oldMsgInDB.message;
    oldMsgInDB.message = newMessage.content;

    if (newMessage.attachments.size === 0) {
        oldMsgInDB.attachments = null;
        oldMsgInDB.attachments_is_deleted = true;
    } else {
        oldMsgInDB.old_attachments = oldMsgInDB.attachments;
        oldMsgInDB.attachments = newMessage.attachments.map((attachment) => attachment.url);
        oldMsgInDB.attachments_is_edited = true;
    }
    await DatabaseConnection.manager.save(oldMsgInDB);
};

export default {
    enabled: true,
    once: false,
    name: 'messageUpdate',
    data: Events.MessageUpdate,
    execute: exec,
} as Event_t;
