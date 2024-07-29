import { Events, Guild } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';


export default {
    enabled: true,
    once: false,
    name: 'guildUpdate',
    data: Events.GuildUpdate,
    execute: async (oldGuild: Guild, newGuild: Guild) => {
        Logger('info', `Guild is updated: "${oldGuild.name}" (${oldGuild.id}) -> "${newGuild.name}" (${newGuild.id})`);
    },
} as Event_t;
