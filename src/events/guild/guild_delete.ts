import { Events, Guild } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'guildDelete',
    data: Events.GuildDelete,
    execute: async (guild: Guild) => {
        Logger('info', `Bot is kicked: "${guild.name} (${guild.id})"`);
    },
} as Event_t;
