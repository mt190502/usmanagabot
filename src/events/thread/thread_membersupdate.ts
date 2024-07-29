import { Collection, Events, Snowflake, ThreadMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'threadMembersUpdate',
    data: Events.ThreadMembersUpdate,
    execute: async (oldMembers: Collection<Snowflake, ThreadMember>, newMembers: Collection<Snowflake, ThreadMember>) => {
        Logger('info', `Thread members updated in ${oldMembers.first().id} -> ${newMembers.first().id}`);
    },
} as Event_t;
