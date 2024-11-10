import { Events, GuildBan } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'guildBanAdd',
    data: Events.GuildBanAdd,
    execute: async (ban: GuildBan) => {
        Logger('info', `User "${ban.user.tag}" has been banned from "${ban.guild.name}".`);
    },
} as Event_t;
