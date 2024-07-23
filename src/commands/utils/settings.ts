import {
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ActionRowBuilder,
    CommandInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { BotCommands } from '../../main';
import { BotCommand } from '../../types/interfaces/commands';

const exec = async (interaction: CommandInteraction) => {
    if (interaction?.commandName === 'settings') {
        const menu = new StringSelectMenuBuilder().setCustomId('settings').addOptions(
            BotCommands.filter((command) => command.settings).map((command) => ({
                label: command.name[0].toUpperCase() + command.name.slice(1),
                description: command.description,
                value: `settings:${command.name}`,
            }))
        );
        const row = new ActionRowBuilder().addComponents(menu);
        await interaction.reply({
            content: 'Select a setting',
            components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
        });
    } else if (interaction.isStringSelectMenu()) {
        const command = BotCommands.get((interaction as StringSelectMenuInteraction).values[0].split(':')[1]);
        if (command) {
            await command.settings?.(interaction as StringSelectMenuInteraction);
        }
    }
};

const scb = async (): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    return new SlashCommandBuilder().setName('settings').setDescription('Change bot settings');
};

export default {
    enabled: true,
    name: 'settings',
    type: 'standard',
    description: 'Change bot settings',

    category: 'utils',
    cooldown: 5,
    usage: '/settings',

    data: scb,
    execute: exec,
} as BotCommand;
