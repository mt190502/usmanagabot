import { Events, Role } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'roleUpdate',
    data: Events.GuildRoleUpdate,
    execute: async (oldRole: Role, newRole: Role) => {
        Logger('info', `${oldRole.name} -> ${newRole.name} in ${oldRole.guild.id}`);
    },
} as Event_t;
