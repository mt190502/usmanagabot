import { BaseEvent } from '@src/types/structure/event';
import { ActivityType, Client, Events } from 'discord.js';
import pkg from '../../package.json';
import { BotData } from '../types/database/entities/bot';

export default class ReadyEvent extends BaseEvent<Events.ClientReady> {
    constructor() {
        super({ enabled: true, type: Events.ClientReady, once: true });
    }

    public async execute(client: Client<true>): Promise<void> {
        const bot_settings = await this.db.findOne(BotData, { where: { id: 1 } });
        this.log.send('info', 'system.startup.complete', { name: pkg.name, version: pkg.version });
        this.log.send('log', 'event.ready.success', { name: client.user.tag ?? 'Unknown#0000' });

        if (bot_settings && bot_settings.enable_random_status && bot_settings.random_statuses.length > 0) {
            const setActivity = () => {
                const status =
                    bot_settings?.random_statuses[Math.floor(Math.random() * bot_settings.random_statuses.length)];
                client.user.setActivity(status!, { type: ActivityType.Watching });
            };

            setActivity();
            setInterval(setActivity, (bot_settings?.random_status_interval ?? 10) * 60 * 1000);
        }
    }
}
