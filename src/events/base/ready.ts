import { BaseEvent } from '@src/types/structure/event';
import { Client, Events } from 'discord.js';
import pkg from '../../../package.json';

export default class ReadyEvent extends BaseEvent<Events.ClientReady> {
    constructor() {
        super({ enabled: true, type: Events.ClientReady, once: true });
    }

    public async execute(client: Client<true>): Promise<void> {
        this.log.send('info', 'main.ready', [pkg.name, pkg.version]);
        this.log.send('info', 'events.base.ready', [client.user.tag ?? 'Unknown#0000']);
    }
}
