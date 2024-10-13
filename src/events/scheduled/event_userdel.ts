import { Events, GuildScheduledEvent, User } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'scheduledEventUserRemove',
    data: Events.GuildScheduledEventUserRemove,
    execute: async (event: GuildScheduledEvent, user: User) => {
        Logger('info', `User ${user.tag} left the guild ${event.guild.name}!`);
    },
} as Event_t;
