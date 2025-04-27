import { ActivityType, Client, Events } from 'discord.js';
import { BotCommands, DatabaseConnection } from '../../main';
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

        setInterval(() => {
            for (const guild of client.guilds.cache.values()) {
                for (const [, cmd_data] of BotCommands.get(BigInt(guild.id)).concat(BotCommands.get(BigInt(0)))) {
                    if (cmd_data.usewithevent?.includes('ready')) cmd_data.execute_when_event('ready', guild.id);
                }
            }
        }, 5000);
    },
} as Event_t;
