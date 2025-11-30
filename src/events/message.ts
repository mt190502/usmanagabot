import { Channel, Events, Message, User } from 'discord.js';
import { Messages } from '../types/database/entities/messages';
import { BaseEvent } from '../types/structure/event';
import { RegisterFact } from '../utils/common';

/**
 * Handles the `messageCreate` event.
 *
 * This event is triggered for every new message created. It logs the message
 * details to the database for moderation and analytics purposes.
 */
class MessageCreateEvent extends BaseEvent<Events.MessageCreate> {
    constructor() {
        super({ enabled: true, type: Events.MessageCreate, once: false });
    }

    /**
     * Executes the event logic.
     *
     * Ignores messages from bots. For valid user messages, it creates a new `Messages`
     * entity and saves it to the database, recording the message ID, timestamp,
     * author, channel, and guild.
     *
     * @param {Message<true>} message The created message, guaranteed to be in a guild.
     */
    public async execute(message: Message<true>): Promise<void> {
        if (message.author?.bot || !message.author?.id || !message.guild?.id) return;
        const guild = await this.db.getGuild(BigInt(message.guild.id));
        const newmsg = new Messages();
        newmsg.timestamp = new Date(message.createdTimestamp);
        newmsg.message_id = BigInt(message.id);
        newmsg.from_channel = await RegisterFact<Channel>(message.channel, message);
        newmsg.from_user = await RegisterFact<User>(message.author, message);
        newmsg.from_guild = guild!;
        await this.db.save(Messages, newmsg);
    }
}

/**
 * Handles the `messageDelete` event.
 *
 * This event is triggered when a message is deleted. It updates the corresponding
 * message record in the database to mark it as deleted.
 */
class MessageDeleteEvent extends BaseEvent<Events.MessageDelete> {
    constructor() {
        super({ enabled: true, type: Events.MessageDelete, once: false });
    }

    /**
     * Executes the event logic.
     *
     * Finds the deleted message in the database and sets the `message_is_deleted` flag to true.
     *
     * @param {Message<true>} message The deleted message, guaranteed to be in a guild.
     */
    public async execute(message: Message<true>): Promise<void> {
        if (message.author?.bot || !message.author?.id || !message.guild?.id) return;
        await RegisterFact<User>(message.author, message);
        await RegisterFact<Channel>(message.channel, message);

        const msg_in_db = await this.db.findOne(Messages, { where: { message_id: BigInt(message.id) } });
        if (!msg_in_db) return;
        msg_in_db.message_is_deleted = true;
        await this.db.save(msg_in_db);
    }
}

/**
 * Handles the `messageUpdate` event.
 *
 * This event is triggered when a message is edited. It updates the corresponding
 * message record in the database to mark it as edited.
 */
class MessageUpdateEvent extends BaseEvent<Events.MessageUpdate> {
    constructor() {
        super({ enabled: true, type: Events.MessageUpdate, once: false });
    }

    /**
     * Executes the event logic.
     *
     * Finds the edited message in the database and sets the `message_is_edited` flag to true.
     *
     * @param {Message<true>} old_message The message before the update.
     * @param {Message<true>} new_message The message after the update.
     */
    public async execute(old_message: Message<true>, new_message: Message<true>): Promise<void> {
        if (
            (old_message.author?.bot && new_message.author?.bot) ||
            (!old_message.author?.id && new_message.author?.id)
        ) {
            return;
        }
        await RegisterFact<User>(old_message.author, old_message);
        await RegisterFact<Channel>(old_message.channel, old_message);

        const msg_in_db = await this.db.findOne(Messages, { where: { message_id: BigInt(old_message.id) } });
        if (!msg_in_db) return;
        msg_in_db.message_is_edited = true;
        await this.db.save(msg_in_db);
    }
}

export default [MessageCreateEvent, MessageDeleteEvent, MessageUpdateEvent];
