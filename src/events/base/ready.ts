import { ActivityType, Client, Events } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'ready',
    data: Events.ClientReady,
    execute: async (client: Client) => {
        client.user.setActivity('systemd', { type: ActivityType.Watching });
        Logger('info', `Logged in as ${client.user.tag}`);
    },
} as Event_t;
