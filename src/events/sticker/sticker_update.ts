import { Events, Sticker } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'stickerUpdate',
    data: Events.GuildStickerUpdate,
    execute: async (oldSticker: Sticker, newSticker: Sticker) => {
        Logger('info', `${oldSticker.name} -> ${newSticker.name} was updated in ${oldSticker.guild.id}`);
    },
} as Event_t;
