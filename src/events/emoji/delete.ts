import { Events, GuildEmoji } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';


export default {
    enabled: true,
    once: false,
    name: 'emojiDelete',
    data: Events.GuildEmojiDelete,
    execute: async (emoji: GuildEmoji) => {
        Logger('info', `Emoji "${emoji.name} (${emoji.id})" deleted in "${emoji.guild.name} (${emoji.guild.id})"`);
    },
} as Event_t;
