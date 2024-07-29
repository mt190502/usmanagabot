import { Events, Guild } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'guildCreate',
    data: Events.GuildCreate,
    execute: async (guild: Guild) => {
        Logger('info', `Bot is added: "${guild.name} (${guild.id})"`);
    },
} as Event_t;
