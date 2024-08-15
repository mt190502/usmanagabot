import { Events, Sticker } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'stickerDelete',
    data: Events.GuildStickerDelete,
    execute: async (sticker: Sticker) => {
        Logger('info', `${sticker.name} was deleted in ${sticker.guild.id}`);
    },
} as Event_t;
