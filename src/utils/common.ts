import { Database } from '@services/database';
import { Channels } from '@src/types/database/entities/channels';
import { Users } from '@src/types/database/entities/users';
import { Channel, Message, User } from 'discord.js';

export const RegisterFact = async <T extends User | Channel>(
    entity: T,
    message?: Message,
): Promise<T extends User ? Users : Channels> => {
    if (message && message.author?.bot) return Promise.reject();
    const db = Database.dbManager;

    if (entity instanceof User) {
        const name = message ? message.author.username : entity.username;
        const id = message ? BigInt(message.author.id) : BigInt(entity.id);
        return ((await db.findOne(Users, { where: { uid: id } })) ||
            (await db.save(Users, {
                uid: id,
                name: name,
            }))) as T extends User ? Users : Channels;
    } else {
        const channel_id = message ? BigInt(message.channel.id) : BigInt(entity.id);
        return ((await db.findOne(Channels, { where: { cid: channel_id } })) ||
            (await db.save(Channels, {
                cid: channel_id,
            }))) as T extends User ? Users : Channels;
    }
};
