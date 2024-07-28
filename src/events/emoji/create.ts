import { Events, GuildEmoji } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'emojiCreate',
    data: Events.GuildEmojiCreate,
    execute: async (emoji: GuildEmoji) => {
        Logger('info', `Emoji created: "${emoji.name} (${emoji.id})"`);
    },
} as Event_t;
