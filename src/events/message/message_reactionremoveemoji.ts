import { Events, MessageReaction } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'messageReactionRemoveEmoji',
    data: Events.MessageReactionRemoveEmoji,
    execute: async (reaction: MessageReaction) => {
        Logger('info', `${reaction.emoji.name} was removed from ${reaction.message.id}`);
    },
} as Event_t;
