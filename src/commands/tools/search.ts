import {
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ActionRowBuilder,
    CommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { DBConnection } from '../../main';
import { Guilds } from '../../types/database/entities/guilds';
import { Search } from '../../types/database/entities/search';
import { BotCommand } from '../../types/interfaces/commands';

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const data = new SlashCommandBuilder().setName('search').setDescription('Search for something');
    const engines = await DBConnection.manager.find(Search, { where: { from_guild: { id: guild.id } } });
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

const settings = async (interaction: StringSelectMenuInteraction) => {
    // const guildInDB = await DBConnection.manager.findOne(Guilds, { where: { guild_id: interaction.guildId } });
    // const database = await DBConnection.manager.find(Search, {
    //     where: { from_guild: { id: guildInDB.id } },
    // });
    const embed = new EmbedBuilder().setColor('Random').setTitle('Search Settings');
    embed.addFields(
        { name: 'Engine', value: 'Google', inline: true },
        { name: 'Query', value: 'Test', inline: true },
        { name: 'Enabled', value: 'Yes', inline: true }
    );
    embed.setTimestamp();
    const menu = new StringSelectMenuBuilder()
        .setCustomId('settings:search')
        .addOptions(
            { label: 'Add Engine', value: 'settings:search:add_engine', description: 'Add a new search engine' },
            { label: 'Remove Engine', value: 'settings:search:remove_engine', description: 'Remove a search engine' },
            { label: 'Edit Engine', value: 'settings:search:edit_engine', description: 'Edit a search engine' }
        );
    const row = new ActionRowBuilder().addComponents(menu);
    interaction.update({
        content: null,
        embeds: [embed.toJSON()],
        components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
    });
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
    settings: settings,
} as BotCommand;
