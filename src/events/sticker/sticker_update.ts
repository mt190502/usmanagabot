import { Events, Sticker } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'stickerUpdate',
    data: Events.GuildStickerUpdate,
    execute: async (old_sticker: Sticker, new_sticker: Sticker) => {
        Logger('info', `${old_sticker.name} -> ${new_sticker.name} was updated in ${old_sticker.guild.id}`);
    },
} as Event_t;
