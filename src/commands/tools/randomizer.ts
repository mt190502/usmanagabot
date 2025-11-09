import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BaseCommand } from '../../types/structure/command';

export default class RandomizerCommand extends BaseCommand {
    constructor() {
        super({
            name: 'randomizer',
            pretty_name: 'Randomizer',
            description: 'Select random options from a list.',
            cooldown: 5,
            help: `
                Select random options from a list.

                **Usage:**
                - \`/randomizer item1 item2 item3 ...\` - Selects a random item from the provided list.

                **Examples:**
                - \`/randomizer apple banana cherry\`
                - \`/randomizer dog cat mouse\`
            `,
        });
        (this.base_cmd_data as SlashCommandBuilder).addStringOption(option =>
            option.setName('item_1').setDescription('The first item to choose from.').setRequired(true)
        ).addStringOption(option =>
            option.setName('item_2').setDescription('The second item to choose from.').setRequired(true)
        ).addStringOption(option =>
            option.setName('extra_items').setDescription('Additional items to choose from, separated by commas.')
        );
    }

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const item_1 = interaction.options.getString('item_1')!;
        const item_2 = interaction.options.getString('item_2')!;
        const extra_items = interaction.options.getString('extra_items');

        const choices: string[] = [item_1, item_2];

        if (extra_items) choices.push(...extra_items.split(/,| /));

        const random = choices[Math.floor(Math.random() * choices.length)];
        await interaction.reply({ content: `I choose: **${random}**`, allowedMentions: { parse: [] } });
    }
}
