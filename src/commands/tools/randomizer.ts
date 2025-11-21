import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BaseCommand } from '../../types/structure/command';

export default class RandomizerCommand extends BaseCommand {
    // =========================== HEADER ============================ //
    constructor() {
        super({ name: 'randomizer', cooldown: 5 });
        (this.base_cmd_data as SlashCommandBuilder)
            .addStringOption((option) =>
                option.setName('item_1').setDescription(this.t('randomizer.parameters.1')).setRequired(true),
            )
            .addStringOption((option) =>
                option.setName('item_2').setDescription(this.t('randomizer.parameters.2')).setRequired(true),
            )
            .addStringOption((option) =>
                option.setName('extra_items').setDescription(this.t('randomizer.parameters.other')).setRequired(false),
            );
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        const item_1 = interaction.options.getString('item_1')!;
        const item_2 = interaction.options.getString('item_2')!;
        const extra_items = interaction.options.getString('extra_items');

        const choices: string[] = [item_1, item_2];

        if (extra_items) choices.push(...extra_items.split(/,| /));

        const random = choices[Math.floor(Math.random() * choices.length)];
        await interaction.reply({
            content: this.t('randomizer.execute.result', { result: random }),
            allowedMentions: { parse: [] },
        });
        this.log.send('debug', 'command.execute.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
    }
    // ================================================================ //
}
