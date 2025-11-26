import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BaseCommand } from '../../types/structure/command';
import { Log } from '../../types/decorator/log';

/**
 * A command that randomly selects one item from a user-provided list.
 *
 * This command takes at least two items and an optional list of extra items,
 * then replies with a single randomly chosen item from the combined list.
 */
export default class RandomizerCommand extends BaseCommand {
    // =========================== HEADER ============================ //
    constructor() {
        super({ name: 'randomizer', cooldown: 5 });

        (this.base_cmd_data as SlashCommandBuilder)
            .addStringOption((option) =>
                option.setName('item_1').setDescription(this.t('parameters.first')).setRequired(true),
            )
            .addStringOption((option) =>
                option.setName('item_2').setDescription(this.t('parameters.second')).setRequired(true),
            )
            .addStringOption((option) =>
                option.setName('extra_items').setDescription(this.t('parameters.other')).setRequired(false),
            );
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * The execution logic for the `randomizer` command.
     * It collects all provided items, randomly selects one, and sends it as a reply.
     * @param interaction The chat input command interaction.
     */
    @Log()
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const item_1 = interaction.options.getString('item_1')!;
        const item_2 = interaction.options.getString('item_2')!;
        const extra_items = interaction.options.getString('extra_items');

        const choices: string[] = [item_1, item_2];

        if (extra_items) choices.push(...extra_items.split(/,| /));

        const random = choices[Math.floor(Math.random() * choices.length)];
        await interaction.reply({
            content: this.t('execute.result', { result: random }, interaction),
            allowedMentions: { parse: [] },
        });
    }
    // ================================================================ //
}
