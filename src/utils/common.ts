import { Message } from "discord.js";
import { DatabaseConnection } from "../main";
import { Channels } from "../types/database/channels";
import { Users } from "../types/database/users";

export const CheckAndAddUser = async (message: Message): Promise<Users> => {
    return await DatabaseConnection.manager.findOne(Users, { where: { uid: Number(message.author?.id) } })
        .then(user => {
            if (user) return user;
            const newUser = new Users();
            newUser.name = message.author?.username;
            newUser.uid = Number(message.author?.id);
            return DatabaseConnection.manager.save(newUser);
        }).catch(error => {
            console.error(error);
            return null;
        });
}

export const CheckAndAddChannel = async (message: Message): Promise<Channels> => {
    return await DatabaseConnection.manager.findOne(Channels, { where: { cid: Number(message.channel.id) } })
        .then(channel => {
            if (channel) return channel;
            const newChannel = new Channels();
            newChannel.cid = Number(message.channel.id);
            return DatabaseConnection.manager.save(newChannel);
        }).catch(error => {
            console.error(error);
            return null;
        });
}