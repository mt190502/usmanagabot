import { Events } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'warn',
    data: Events.Warn,
    execute: async (info: string) => {
        Logger('warn', info);
    },
} as Event_t;
