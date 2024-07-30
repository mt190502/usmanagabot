import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Search } from "../../types/database/search";
import { Command_t } from "../../types/interface/commands";

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const data = new SlashCommandBuilder().setName('search').setDescription('Search for something');
    const engines = await DatabaseConnection.manager.find(Search, { where: { from_guild: { id: guild.id } } });
    if (engines.length === 0) {
        data.addStringOption((option) =>
            option
                .setName('engine')
                .setDescription('Search engine')
                .setRequired(true)
                .addChoices({ name: 'Google', value: 'https://google.com/search?q=' })
                .addChoices({ name: 'DuckDuckGo', value: 'https://duckduckgo.com/?q=' })
                .addChoices({ name: 'Brave', value: 'https://search.brave.com/search?q=' })
        );
        data.addStringOption((option) => option.setName('query').setDescription('Search query').setRequired(true));
        return data;
    }
    data.addStringOption((option) =>
        option
            .setName('engine')
            .setDescription('Search engine')
            .setRequired(true)
            .addChoices(...engines.map((engine) => ({ name: engine.engine_name, value: engine.engine_url })))
    );
    data.addStringOption((option) => option.setName('query').setDescription('Search query').setRequired(true));
    return data;
};

const exec = async (interaction: CommandInteraction) => {
    const engine = interaction.options.data.find((option) => option.name === 'engine')?.value;
    const query = interaction.options.data.find((option) => option.name === 'query')?.value;
    await interaction.reply(`${engine}${query}`);
};

export default {
    enabled: true,
    name: 'search',
    type: 'customizable',
    description: 'Search for something',

    category: 'tools',
    cooldown: 5,
    usage: '/search',

    data: scb,
    execute: exec,
    // settings: settings,
} as Command_t;