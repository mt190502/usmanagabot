import { Events, GuildScheduledEvent } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'scheduledEventUpdate',
    data: Events.GuildScheduledEventUpdate,
    execute: async (oldEvent: GuildScheduledEvent, newEvent: GuildScheduledEvent) => {
        Logger('info', `Scheduled event updated: ${oldEvent.name} -> ${newEvent.name}`);
    },
} as Event_t;
