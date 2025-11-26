import { BaseInteraction } from 'discord.js';
import { Logger } from '../../services/logger';

export function Log() {
    return function(target: object, property_key: string, descriptor: PropertyDescriptor) {
        const original_method = descriptor.value;

        descriptor.value = async function(...args: unknown[]) {
            const interaction = args[0] as BaseInteraction;
            const command_name = (this as { name: string }).name;

            Logger.send('debug', 'command.execute.start', {
                name: command_name,
                guild: interaction.guild,
                user: interaction.user,
            });

            try {
                const result = await original_method.apply(this, args);
                Logger.send('debug', 'command.execute.success', {
                    name: command_name,
                    guild: interaction.guild,
                    user: interaction.user,
                });
                return result;
            } catch (error) {
                Logger.send('error', 'command.execute.failed', {
                    name: command_name,
                    guild: interaction.guild,
                    user: interaction.user,
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        };

        return descriptor;
    };
}