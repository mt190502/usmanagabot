import { Events, ThreadMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'threadMemberUpdate',
    data: Events.ThreadMemberUpdate,
    execute: async (old_member: ThreadMember, new_member: ThreadMember) => {
        Logger('info', `${old_member.id} -> ${new_member.id} was updated in ${old_member.guildMember.guild.id}`);
    },
} as Event_t;
