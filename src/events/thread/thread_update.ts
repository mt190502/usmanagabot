import { Events, ThreadChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'threadUpdate',
    data: Events.ThreadUpdate,
    execute: async (oldThread: ThreadChannel, newThread: ThreadChannel) => {
        Logger('info', `${oldThread.name} -> ${newThread.name} was updated in ${oldThread.guild.id}`);
    },
} as Event_t;
