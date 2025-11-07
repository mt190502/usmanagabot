import { Channel, Events, Message, User } from 'discord.js';
import { Guilds } from '../types/database/entities/guilds';
import { Messages } from '../types/database/entities/messages';
import { BaseEvent } from '../types/structure/event';
import { RegisterFact } from '../utils/common';

class MessageCreateEvent extends BaseEvent<Events.MessageCreate> {
    constructor() {
        super({ enabled: true, type: Events.MessageCreate, once: false });
    }

    public async execute(message: Message<true>): Promise<void> {
        if (message.author?.bot || !message.author?.id || !message.guild?.id) return;
        const guild = await (await this.db).findOne(Guilds, { where: { gid: BigInt(message.guild.id) } });
        const newmsg = new Messages();
        newmsg.timestamp = new Date(message.createdTimestamp);
        newmsg.message_id = BigInt(message.id);
        newmsg.from_channel = await RegisterFact<Channel>(message.channel, message);
        newmsg.from_user = await RegisterFact<User>(message.author, message);
        newmsg.from_guild = guild!;
        await (await this.db).save(Messages, newmsg);
    }
}

class MessageDeleteEvent extends BaseEvent<Events.MessageDelete> {
    constructor() {
        super({ enabled: true, type: Events.MessageDelete, once: false });
    }

    public async execute(message: Message<true>): Promise<void> {
        if (message.author?.bot || !message.author?.id || !message.guild?.id) return;
        await RegisterFact<User>(message.author, message);
        await RegisterFact<Channel>(message.channel, message);

        const msg_in_db = await (await this.db).findOne(Messages, { where: { message_id: BigInt(message.id) } });
        if (!msg_in_db) return;
        msg_in_db.message_is_deleted = true;
        await (await this.db).save(msg_in_db);
    }
}

class MessageUpdateEvent extends BaseEvent<Events.MessageUpdate> {
    constructor() {
        super({ enabled: true, type: Events.MessageUpdate, once: false });
    }

    public async execute(old_message: Message<true>, new_message: Message<true>): Promise<void> {
        if (
            (old_message.author?.bot && new_message.author?.bot) ||
            (!old_message.author?.id && new_message.author?.id)
        ) {
            return;
        }
        await RegisterFact<User>(old_message.author, old_message);
        await RegisterFact<Channel>(old_message.channel, old_message);

        const msg_in_db = await (await this.db).findOne(Messages, { where: { message_id: BigInt(old_message.id) } });
        if (!msg_in_db) return;
        msg_in_db.message_is_edited = true;
        await (await this.db).save(msg_in_db);
    }
}

export default [MessageCreateEvent, MessageDeleteEvent, MessageUpdateEvent];
