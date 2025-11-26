import { CommandLoader } from '@src/commands';
import { ClientEvents } from 'discord.js';
import { BotClient } from '../../services/client';

export function ChainEvent(o: { type: keyof ClientEvents; once?: boolean }): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        BotClient.client[o.once ? 'once' : 'on'](o.type, async (...args) => {
            if (typeof descriptor_func.value !== 'function') return;
            const guild_command = [...CommandLoader.BotCommands.values()].flatMap((cmd_map) => [...cmd_map.values()]);
            const target = guild_command.find((cmd) => Object.getPrototypeOf(cmd) === target_class);
            descriptor_func.value.apply(target, args);
        });
    };
}
