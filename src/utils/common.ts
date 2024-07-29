import { Message } from "discord.js";
import { DatabaseConnection } from "../main";
import { Channels } from "../types/database/channels";
import { Users } from "../types/database/users";

export const CheckAndAddUser = async (message: Message): Promise<Users> => {
    let userInDB = await DatabaseConnection.manager.findOne(Users, { where: { uid: Number(message.author?.id) } });
    if (!userInDB) {
        const newUser = new Users();
        newUser.name = message.author?.username;
        newUser.uid = Number(message.author?.id);
        userInDB = await DatabaseConnection.manager.save(newUser);
    }
    return userInDB;
}

export const CheckAndAddChannel = async (message: Message): Promise<Channels> => {
    let channelInDB = await DatabaseConnection.manager.findOne(Channels, { where: { cid: Number(message.channel.id) } });
    if (!channelInDB) {
        const newChannel = new Channels();
        newChannel.cid = Number(message.channel.id);
        channelInDB = await DatabaseConnection.manager.save(newChannel);
    }
    return channelInDB;
}