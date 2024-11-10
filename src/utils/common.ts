import { Channel, Message, User } from 'discord.js';
import { DatabaseConnection } from '../main';
import { Channels } from '../types/database/channels';
import { Users } from '../types/database/users';

export const CheckAndAddUser = async (user: User, message?: Message): Promise<Users> => {
    if (message && message.author?.bot) return null;
    const user_name = message ? message.author?.username : user.username;
    const user_id = message ? BigInt(message.author?.id) : BigInt(user.id);
    return await DatabaseConnection.manager
        .findOne(Users, { where: { uid: user_id } })
        .then((usr) => {
            if (usr) return usr;
            const new_user = new Users();
            new_user.name = user_name;
            new_user.uid = user_id;
            return DatabaseConnection.manager.save(new_user);
        })
        .catch((error) => {
            console.error(error);
            return null;
        });
};

export const CheckAndAddChannel = async (channel: Channel, message?: Message): Promise<Channels> => {
    if (message && message.author?.bot) return null;
    const channel_id = message ? BigInt(message.channel.id) : BigInt(channel.id);
    return await DatabaseConnection.manager
        .findOne(Channels, { where: { cid: channel_id } })
        .then((c) => {
            if (c) return c;
            const new_channel = new Channels();
            new_channel.cid = channel_id;
            return DatabaseConnection.manager.save(new_channel);
        })
        .catch((error) => {
            console.error(error);
            return null;
        });
};
