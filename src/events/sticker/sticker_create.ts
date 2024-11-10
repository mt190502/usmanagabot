import { Events, Sticker } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'stickerCreate',
    data: Events.GuildStickerCreate,
    execute: async (sticker: Sticker) => {
        Logger('info', `${sticker.name} was created in ${sticker.guild.id}`);
    },
} as Event_t;
