import { Collection, Events, Snowflake, ThreadChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'threadListSync',
    data: Events.ThreadListSync,
    execute: async (collection: Collection<Snowflake, ThreadChannel>) => {
        Logger('info', `Threads synced in ${collection.first().guild.id}`);
    },
} as Event_t;
