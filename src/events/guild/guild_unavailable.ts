import { Events, Guild } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'guildUnavailable',
    data: Events.GuildUnavailable,
    execute: async (guild: Guild) => {
        Logger('info', `Guild ${guild.name} is unavailable!`);
    },
} as Event_t;
