import { Collection, Events, Message, MessageReaction, Snowflake } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'messageReactionRemoveAll',
    data: Events.MessageReactionRemoveAll,
    execute: async (message: Message, reactions: Collection<string | Snowflake, MessageReaction>) => {
        Logger(
            'info',
            `${message.id} had all reactions removed in ${message.guild.id}: ${reactions.map((reaction) => reaction.emoji.name).join(', ')}`
        );
    },
} as Event_t;
