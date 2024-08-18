import { Events, GuildEmoji } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'emojiUpdate',
    data: Events.GuildEmojiUpdate,
    execute: async (oldEmoji: GuildEmoji, newEmoji: GuildEmoji) => {
        Logger(
            'info',
            `Emoji "${oldEmoji.name} (${oldEmoji.id})" updated to "${newEmoji.name} (${newEmoji.id})" in "${oldEmoji.guild.name} (${oldEmoji.guild.id})"`
        );
    },
} as Event_t;
