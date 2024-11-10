import { Events, ThreadChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'threadDelete',
    data: Events.ThreadDelete,
    execute: async (thread: ThreadChannel) => {
        Logger('info', `${thread.name} was deleted in ${thread.guild.id}`);
    },
} as Event_t;
