import { Collection, Events, Snowflake, ThreadMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'threadMembersUpdate',
    data: Events.ThreadMembersUpdate,
    execute: async (
        old_members: Collection<Snowflake, ThreadMember>,
        new_members: Collection<Snowflake, ThreadMember>
    ) => {
        Logger('info', `Thread members updated in ${old_members} -> ${new_members}`);
    },
} as Event_t;
