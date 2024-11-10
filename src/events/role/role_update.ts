import { Events, Role } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'roleUpdate',
    data: Events.GuildRoleUpdate,
    execute: async (old_role: Role, new_role: Role) => {
        Logger('info', `${old_role.name} -> ${new_role.name} in ${old_role.guild.id}`);
    },
} as Event_t;
