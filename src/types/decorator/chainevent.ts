import { ClientEvents } from 'discord.js';
import { BotClient } from '../../services/client';

export function ChainEvent(o: { type: keyof ClientEvents; once?: boolean }): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        BotClient.client[o.once ? 'once' : 'on'](o.type, async (...args) => {
            if (typeof descriptor_func.value === 'function') {
                descriptor_func.value.apply(target_class, args);
            }
        });
    };
}
