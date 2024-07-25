import { Events } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'error',
    data: Events.Error,
    execute: async (error: Error) => {
        Logger('error', error.message);
    },
} as Event_t;
