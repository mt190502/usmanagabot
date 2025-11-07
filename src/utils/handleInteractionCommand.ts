import {
    ActionRowBuilder,
    CommandInteraction,
    Interaction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import 'reflect-metadata';
import { CommandLoader } from '../commands';
import { CustomizableCommand } from '../types/structure/command';

export const handleCommand = async (action: string, interaction: Interaction | CommandInteraction) => {
    const command_name = action.split(':')[1];
    const command: CustomizableCommand | undefined = CommandLoader.BotCommands.get(interaction.guild!.id)?.get(
        command_name,
    ) as CustomizableCommand | undefined;
    if (!command) return;

    if (action.startsWith('execute') && command.execute) {
        command.execute(interaction);
    } else if (action.startsWith('settings') && command instanceof CustomizableCommand) {
        const requested = action.split(':');
        const setting_actions = Reflect.getMetadata('custom:settings', command.constructor);
        if (requested.length == 2) {
            const subcommands: { label: string; description: string; value: string }[] = [];
            for (const [name, setting] of setting_actions) {
                subcommands.push({
                    label: name,
                    description: setting.desc,
                    value: `settings:${command.name}:${name}`,
                });
            }
            await (interaction as StringSelectMenuInteraction).update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('settings')
                                .setPlaceholder('Select a setting to configure...')
                                .addOptions(subcommands),
                        )
                        .toJSON(),
                ],
            });
        } else if (requested.length == 3) {
            const setting = setting_actions.get(requested[2]);
            setting.func.value(command, interaction);
        }
    }
};
