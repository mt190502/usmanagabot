import { BaseEvent } from '@src/types/structure/event';
import { Client, Events } from 'discord.js';
import pkg from '../../package.json';

export default class ReadyEvent extends BaseEvent<Events.ClientReady> {
    constructor() {
        super({ enabled: true, type: Events.ClientReady, once: true });
    }

    public async execute(client: Client<true>): Promise<void> {
        this.log.send('info', 'system.startup.complete', { name: pkg.name, version: pkg.version });
        this.log.send('log', 'event.ready.success', { name: client.user.tag ?? 'Unknown#0000' });
    }
}
