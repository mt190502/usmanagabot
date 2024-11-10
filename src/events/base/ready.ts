import { ActivityType, Client, Events } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { BotData } from '../../types/database/bot';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'ready',
    data: Events.ClientReady,
    execute: async (client: Client) => {
        const statuses = await DatabaseConnection.manager
            .findOne(BotData, { where: { key: 'bot_statuses' } })
            .then((data) => {
                return JSON.parse(data.value);
            })
            .catch(() => {
                return ['your commands'];
            });

        const setActivity = () => {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            client.user.setActivity(status, { type: ActivityType.Watching });
        };

        setActivity();
        setInterval(setActivity, 3600000);

        Logger('info', `Logged in as ${client.user.tag}`);
    },
} as Event_t;
