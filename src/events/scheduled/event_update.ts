import { Events, GuildScheduledEvent } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'scheduledEventUpdate',
    data: Events.GuildScheduledEventUpdate,
    execute: async (old_event: GuildScheduledEvent, new_event: GuildScheduledEvent) => {
        Logger('info', `Scheduled event updated: ${old_event.name} -> ${new_event.name}`);
    },
} as Event_t;
