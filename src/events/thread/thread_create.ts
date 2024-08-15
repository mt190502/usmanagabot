import { Events, ThreadChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'threadCreate',
    data: Events.ThreadCreate,
    execute: async (thread: ThreadChannel) => {
        Logger('info', `${thread.name} was created in ${thread.guild.id}`);
    },
} as Event_t;
