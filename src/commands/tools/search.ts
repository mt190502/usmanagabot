import { ActionRowBuilder, APIActionRowComponent, APIMessageActionRowComponent, CommandInteraction, ModalActionRowComponentBuilder, ModalBuilder, SlashCommandBuilder, SlashCommandStringOption, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Search } from "../../types/database/search";
import { Users } from "../../types/database/users";
import { Command_t } from "../../types/interface/commands";
import { RESTCommandLoader } from "../loader";

/*
    0: Main Menu
    1: Add Engine
    2: Edit Engine
    3: Remove Engine
    11: Add Engine Modal
    21: Edit Engine Modal
    22: Edit Engine on Database
    31: Remove Engine Modal
*/

const settings = async (interaction: any) => {
    const guild: Guilds = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });
    const user: Users = await DatabaseConnection.manager.findOne(Users, { where: { uid: BigInt(interaction.user.id) } });
    const engines: Search[] = await DatabaseConnection.manager.find(Search, { where: { from_guild: { id: guild.id } } });

    const engine_name = new TextInputBuilder().setCustomId('engine_name').setLabel('Engine Name').setStyle(TextInputStyle.Short)
    const engine_url = new TextInputBuilder().setCustomId('engine_url').setLabel('Engine URL').setStyle(TextInputStyle.Short)

    const menu_path = interaction.values ? interaction.values[0].split(':').at(-1).split('/') : interaction.customId.split(':').at(-1).split('/');
    const menu = new StringSelectMenuBuilder().setCustomId('settings:search:0').addOptions(
        { label: 'Add Engine', description: 'Add a new search engine', value: 'settings:search:1' },
        { label: 'Edit Engine', description: 'Edit an existing search engine', value: 'settings:search:2' },
        { label: 'Remove Engine', description: 'Remove an existing search engine', value: 'settings:search:3' },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    );
    const row = new ActionRowBuilder().addComponents(menu);

    if (engines.length === 0) {
        const default_engines = [{ key: "Google", value: "https://google.com/search?q=" }, { key: "DuckDuckGo", value: "https://duckduckgo.com/?q=" }];
        for (const engine of default_engines) {
            const new_engine = new Search();
            new_engine.engine_name = engine.key;
            new_engine.engine_url = engine.value;
            new_engine.from_guild = guild;
            new_engine.from_user = user;
            await DatabaseConnection.manager.save(new_engine);
        } 
    }

    switch (menu_path[0]) {
        case '1':
            await interaction.showModal(new ModalBuilder().setCustomId('settings:search:11').setTitle('Add Engine').addComponents(
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(engine_name),
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(engine_url)
            ));
            break;
        case '2':
            await interaction.update({
                content: 'Select an engine to edit',
                components: [(new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('settings:search:21').addOptions(
                        ...engines.map((engine) => ({ label: engine.engine_name, description: engine.engine_url.toString(), value: `settings:search:21/${engine.engine_name}` })),
                        { label: 'Back', description: 'Go back to the previous menu', value: 'settings:search:0' }
                    ))).toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
            });
            break;
        case '3':
            await interaction.update({
                content: 'Select an engine to remove',
                components: [(new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('settings:search:31').addOptions(
                        ...engines.map((engine) => ({ label: engine.engine_name, description: engine.engine_url.toString(), value: `settings:search:31/${engine.engine_name}` })),
                        { label: 'Back', description: 'Go back to the previous menu', value: 'settings:search:0' }
                    ))).toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
            });
            break;
        case '11':
            const new_engine = new Search();
            new_engine.engine_name = interaction.fields.getTextInputValue('engine_name');
            new_engine.engine_url = interaction.fields.getTextInputValue('engine_url');
            new_engine.from_guild = guild;
            new_engine.from_user = user;
            await DatabaseConnection.manager.save(new_engine).then(() => {
                interaction.update('Engine added');
            }).catch((error) => {
                interaction.update('Error adding engine: ' + error);
            });
            await RESTCommandLoader(Number(guild.gid));
            break;
        case '21':
            if (!menu_path[1]) break;
            const selected = engines.find((engine) => engine.engine_name === menu_path[1]);
            
            await interaction.showModal(new ModalBuilder().setCustomId(`settings:search:22/${selected.engine_name}`).setTitle('Edit Engine').addComponents(
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(engine_name.setValue(selected.engine_name)),
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(engine_url.setValue(selected.engine_url.toString()))
            ));
            break;
        case '22':
            const edit_engine = await DatabaseConnection.manager.findOne(Search, { where: { engine_name: menu_path[1] } });
            edit_engine.engine_name = interaction.fields.getTextInputValue('engine_name');
            edit_engine.engine_url = interaction.fields.getTextInputValue('engine_url');
            await DatabaseConnection.manager.save(edit_engine).then(() => {
                interaction.update({
                    content: 'Engine edited',
                    components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                });
            }).catch((error) => {
                interaction.update('Error editing engine: ' + error);
            });
            await RESTCommandLoader(Number(guild.gid));
            break;
        case '31':
            if (!menu_path[1]) break;
            const remove_engine = await DatabaseConnection.manager.findOne(Search, { where: { engine_name: menu_path[1] } });
            await DatabaseConnection.manager.remove(remove_engine).then(() => {
                interaction.update({
                    content: 'Engine removed',
                    components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                });
            }).catch((error) => {
                interaction.update('Error removing engine: ' + error);
            });
            await RESTCommandLoader(Number(guild.gid));
            break;
        default:
            await interaction.update({
                content: 'Select an option',
                components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
            });
            break;
    };
}

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const data = new SlashCommandBuilder().setName('search').setDescription('Search for something');
    const engines = await DatabaseConnection.manager.find(Search, { where: { from_guild: { id: guild.id } } });
    if (engines.length === 0) {
        data.addStringOption((option: SlashCommandStringOption) =>
            option
                .setName('engine')
                .setDescription('Search engine')
                .setRequired(true)
                .addChoices({ name: 'Google', value: 'https://google.com/search?q=' })
                .addChoices({ name: 'DuckDuckGo', value: 'https://duckduckgo.com/?q=' })
        );
        data.addStringOption((option) => option.setName('query').setDescription('Search query').setRequired(true));
        return data;
    }
    data.addStringOption((option: SlashCommandStringOption) =>
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
    settings: settings,
} as Command_t;