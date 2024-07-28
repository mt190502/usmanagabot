import { Events, GuildBan } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'guildBanRemove',
    data: Events.GuildBanRemove,
    execute: async (ban: GuildBan) => {
        Logger('info', `User "${ban.user.tag}" has been unbanned from "${ban.guild.name}".`);
    },
} as Event_t;
