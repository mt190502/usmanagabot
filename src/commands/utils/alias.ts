import { SlashCommandBuilder } from "discord.js";
import { Command_t } from "../../types/interface/commands";

const exec = async (interaction: any) => {
    const action = interaction.options.getString('action');
    const keyword = interaction.options.getString('keyword');
    const alias = interaction.options.getString('alias');

    switch (action) {
        case 'add':
            await interaction.reply(`Added alias ${alias} for keyword ${keyword}`);
            break;
        case 'remove':
            await interaction.reply(`Removed alias ${alias} for keyword ${keyword}`);
            break;
        case 'list':
            await interaction.reply(`List of aliases for keyword ${keyword}`);
            break;
    }
}

const scb = async (): Promise<Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">> => {
    const data = new SlashCommandBuilder().setName('alias').setDescription('Create an alias for keyword');
    data.addStringOption(option => option.setName('action').setDescription('Action to perform').setRequired(true)
            .addChoices(
                { name: 'Add', value: 'add' },
                { name: 'Remove', value: 'remove' },
                { name: 'List', value: 'list' }
            ));
    data.addStringOption(option => option.setName('keyword').setDescription('Keyword to alias').setRequired(true))
    data.addStringOption(option => option.setName('alias').setDescription('Alias for keyword').setRequired(true))
    return data;
}

export default {
    enabled: true,
    name: 'alias',
    type: 'standard',
    description: 'Create an alias for keyword',

    category: 'utils',
    cooldown: 5,
    usage: '/alias <add|remove|list> <keyword> <alias>',

    data: scb,
    execute: exec
} as Command_t;