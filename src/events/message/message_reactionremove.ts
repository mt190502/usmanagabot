import { Events, MessageReaction, User } from "discord.js";
import { Event_t } from "../../types/interface/events";
import { Logger } from "../../utils/logger";

export default {
    enabled: true,
    once: false,
    name: 'messageReactionRemove',
    data: Events.MessageReactionRemove,
    execute: async (reaction: MessageReaction, user: User) => {
        Logger('info', `${user.tag} removed a reaction from a message in ${reaction.message.channel.id}`);
    },
} as Event_t;