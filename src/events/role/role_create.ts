import { Events, Role } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'roleCreate',
    data: Events.GuildRoleCreate,
    execute: async (role: Role) => {
        Logger('info', `${role.name} was created in ${role.guild.id}`);
    },
} as Event_t;
