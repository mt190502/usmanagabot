import { Events, ThreadChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'threadUpdate',
    data: Events.ThreadUpdate,
    execute: async (old_thread: ThreadChannel, new_thread: ThreadChannel) => {
        Logger('info', `${old_thread.name} -> ${new_thread.name} was updated in ${old_thread.guild.id}`);
    },
} as Event_t;
