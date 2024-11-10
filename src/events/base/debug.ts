import { Events } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'debugger',
    data: Events.Debug,
    execute: async (info: string) => {
        Logger('debug', info);
    },
} as Event_t;
