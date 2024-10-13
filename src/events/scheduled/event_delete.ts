import { Events, GuildScheduledEvent } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'scheduledEventDelete',
    data: Events.GuildScheduledEventDelete,
    execute: async (event: GuildScheduledEvent) => {
        Logger('info', `Scheduled event deleted: ${event.name}`);
    },
} as Event_t;
