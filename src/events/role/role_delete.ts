import { Events, Role } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'roleDelete',
    data: Events.GuildRoleDelete,
    execute: async (role: Role) => {
        Logger('info', `${role.name} was deleted in ${role.guild.id}`);
    },
} as Event_t;
