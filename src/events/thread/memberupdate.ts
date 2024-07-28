import { Events, ThreadMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'threadMemberUpdate',
    data: Events.ThreadMemberUpdate,
    execute: async (oldMember: ThreadMember, newMember: ThreadMember) => {
        Logger('info', `${oldMember.id} -> ${newMember.id} was updated in ${oldMember.guildMember.guild.id}`);
    },
} as Event_t;
