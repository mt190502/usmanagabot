import { Events, GuildScheduledEvent, User } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'scheduledEventUserAdd',
    data: Events.GuildScheduledEventUserAdd,
    execute: async (event: GuildScheduledEvent, user: User) => {
        Logger('info', `User ${user.tag} joined the guild ${event.guild.name}!`);
    },
} as Event_t;
