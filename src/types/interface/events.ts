import { Awaitable, ClientEvents } from 'discord.js';

type EventMethods<K extends keyof ClientEvents> = {
    enabled: boolean;
    once: boolean;
    name: string;
    data: keyof ClientEvents;
    execute: (...args: ClientEvents[K]) => Awaitable<void>;
};

export type Events_t = { [K in keyof ClientEvents]: EventMethods<K> }[keyof ClientEvents];
