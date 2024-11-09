import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command_t } from '../../types/interface/commands';

const exec = async (interaction: ChatInputCommandInteraction) => {
    const item_1 = interaction.options.getString('item_1');
    const item_2 = interaction.options.getString('item_2');
    const extra_items = interaction.options.getString('extra_items');

    const choices: string[] = [item_1, item_2];

    if (extra_items) choices.push(...extra_items.split(/,| /));

    const random = choices[Math.floor(Math.random() * choices.length)];
    await interaction.reply({ content: `I choose: **${random}**`, allowedMentions: { parse: [] } });
};

const scb = async (): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const data = new SlashCommandBuilder()
        .setName('randomizer')
        .setDescription('Selects a random item from a list of items.');
    data.addStringOption((option) =>
        option.setName('item_1').setDescription('The first item to choose from.').setRequired(true)
    );
    data.addStringOption((option) =>
        option.setName('item_2').setDescription('The second item to choose from.').setRequired(true)
    );
    data.addStringOption((option) =>
        option
            .setName('extra_items')
            .setDescription('Any extra items to choose from. (Separated by spaces or commas.)')
            .setRequired(false)
    );
    return data;
};

export default {
    enabled: true,
    name: 'randomizer',
    pretty_name: 'Randomizer',
    type: 'standard',
    description: 'Selects a random item from a list of items.',

    category: 'tools',
    cooldown: 5,
    parameters: '<item_1> <item_2> [extra_items]',

    data: [scb],
    execute: exec,
} as Command_t;
