import { Interaction, Message } from "discord.js";
import { DatabaseConnection } from "../main";
import { Channels } from "../types/database/channels";
import { Users } from "../types/database/users";

export const CheckAndAddUser = async (message?: Message, interaction?: Interaction): Promise<Users> => {
    if (message && message.author?.bot) return null;
    const user_name = message ? message.author?.username : interaction?.user.username;
    const user_id = message ? Number(message.author?.id) : Number(interaction?.user.id);
    return await DatabaseConnection.manager.findOne(Users, { where: { uid: user_id } })
        .then(user => {
            if (user) return user;
            const newUser = new Users();
            newUser.name = user_name;
            newUser.uid = user_id;
            return DatabaseConnection.manager.save(newUser);
        }).catch(error => {
            console.error(error);
            return null;
        });
}

export const CheckAndAddChannel = async (message?: Message, interaction?: Interaction): Promise<Channels> => {
    if (message && message.author?.bot) return null;
    const channel_id = message ? Number(message.channel.id) : Number(interaction?.channelId);
    return await DatabaseConnection.manager.findOne(Channels, { where: { cid: channel_id } })
        .then(channel => {
            if (channel) return channel;
            const newChannel = new Channels();
            newChannel.cid = channel_id;
            return DatabaseConnection.manager.save(newChannel);
        }).catch(error => {
            console.error(error);
            return null;
        });
}