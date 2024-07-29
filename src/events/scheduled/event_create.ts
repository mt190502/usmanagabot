import { Events, GuildScheduledEvent } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'scheduledEventCreate',
    data: Events.GuildScheduledEventCreate,
    execute: async (event: GuildScheduledEvent) => {
        Logger('info', `Scheduled event created: ${event.name}`);
    },
} as Event_t;
