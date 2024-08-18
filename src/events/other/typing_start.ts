import { Events, Typing } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'typingStart',
    data: Events.TypingStart,
    execute: async (typing: Typing) => {
        Logger('info', `${typing.user.tag} started typing in ${typing.channel.id}`);
    },
} as Event_t;
