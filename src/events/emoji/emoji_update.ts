import { Events, GuildEmoji } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'emojiUpdate',
    data: Events.GuildEmojiUpdate,
    execute: async (old_emoji: GuildEmoji, new_emoji: GuildEmoji) => {
        Logger(
            'info',
            `Emoji "${old_emoji.name} (${old_emoji.id})" updated to "${new_emoji.name} (${new_emoji.id})" in "${old_emoji.guild.name} (${old_emoji.guild.id})"`
        );
    },
} as Event_t;
