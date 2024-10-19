import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    Colors,
    CommandInteraction,
    EmbedBuilder,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    SlashCommandStringOption,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Search } from '../../types/database/search';
import { SearchEngines } from '../../types/database/search_engines';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';
import { RESTCommandLoader } from '../loader';

const settings = async (interaction: StringSelectMenuInteraction | ModalSubmitInteraction) => {
    const guild = await DatabaseConnection.manager.findOne(Guilds, {
        where: { gid: BigInt(interaction.guild.id) },
    });
    const user = await DatabaseConnection.manager.findOne(Users, {
        where: { uid: BigInt(interaction.user.id) },
    });

    const search_system = await DatabaseConnection.manager.findOne(Search, {
        where: { from_guild: { id: guild.id } },
    });
    const search_engines = await DatabaseConnection.manager.find(SearchEngines, {
        where: { from_guild: { id: guild.id } },
    });

    if (!search_system) {
        const new_search = new Search();
        new_search.from_guild = guild;
        new_search.from_user = user;
        await DatabaseConnection.manager.save(new_search);

        const default_engines = [
            { key: 'Google', value: 'https://google.com/search?q=' },
            { key: 'DuckDuckGo', value: 'https://duckduckgo.com/?q=' },
        ];

        for (const engine of default_engines) {
            const new_engine = new SearchEngines();
            new_engine.from_user = user;
            new_engine.from_guild = guild;
            new_engine.engine_name = engine.key;
            new_engine.engine_url = engine.value;
            await DatabaseConnection.manager.save(new_engine);
        }
        return settings(interaction);
    }

    let status = search_system.is_enabled ? 'Disable' : 'Enable';
    const menu_path =
        interaction.type == 3
            ? (interaction as StringSelectMenuInteraction).values[0].split(':').at(-1).split('/')
            : (interaction as ModalSubmitInteraction).customId.split(':').at(-1).split('/');

    const engine_name = new TextInputBuilder()
        .setCustomId('engine_name')
        .setLabel('Engine Name')
        .setStyle(TextInputStyle.Short);
    const engine_url = new TextInputBuilder()
        .setCustomId('engine_url')
        .setLabel('Engine URL')
        .setStyle(TextInputStyle.Short);

    const genPostEmbed = (warn?: string) => {
        const post = new EmbedBuilder().setTitle(':gear: Search Settings');
        const fields: { name: string; value: string }[] = [];

        if (warn) {
            fields.push({ name: ':warning: Warning', value: warn });
            post.setColor(Colors.Yellow);
        } else {
            post.setColor(Colors.Blurple);
        }

        fields.push(
            {
                name: 'Enabled',
                value: search_system.is_enabled ? ':green_circle: True' : ':red_circle: False',
            },
            {
                name: 'Search Engines',
                value: search_engines ? search_engines.map((engine) => engine.engine_name).join(', ') : 'Not set',
            }
        );
        post.addFields(fields);
        return post;
    };

    const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
        const menu = new StringSelectMenuBuilder().setCustomId('settings:search:0').addOptions([
            {
                label: `${status} Search System`,
                description: 'Enable or disable the search system',
                value: 'settings:search:1',
            },
            { label: 'Add Engine', description: 'Add a new search engine', value: 'settings:search:2' },
            { label: 'Edit Engine', description: 'Edit an existing search engine', value: 'settings:search:3' },
            { label: 'Remove Engine', description: 'Remove an existing search engine', value: 'settings:search:4' },
            { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
        ]);
        return new ActionRowBuilder()
            .addComponents(menu)
            .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>;
    };

    switch (menu_path[0]) {
        case '1':
            search_system.is_enabled = !search_system.is_enabled;
            status = search_system.is_enabled ? 'Disable' : 'Enable';
            await DatabaseConnection.manager.save(search_system);
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            await RESTCommandLoader(guild.gid);
            break;
        case '2':
            await (interaction as StringSelectMenuInteraction).showModal(
                new ModalBuilder()
                    .setCustomId('settings:search:21')
                    .setTitle('Add Engine')
                    .addComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(engine_name),
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(engine_url)
                    )
            );
            break;
        case '3':
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder().setCustomId('settings:search:31').addOptions(
                                ...search_engines.map((engine) => ({
                                    label: engine.engine_name,
                                    description: engine.engine_url.toString(),
                                    value: `settings:search:31/${engine.engine_name}`,
                                })),
                                {
                                    label: 'Back',
                                    description: 'Go back to the previous menu',
                                    value: 'settings:search:0',
                                }
                            )
                        )
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '4':
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder().setCustomId('settings:search:41').addOptions(
                                ...search_engines.map((engine) => ({
                                    label: engine.engine_name,
                                    description: engine.engine_url.toString(),
                                    value: `settings:search:41/${engine.engine_name}`,
                                })),
                                {
                                    label: 'Back',
                                    description: 'Go back to the previous menu',
                                    value: 'settings:search:0',
                                }
                            )
                        )
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '21': {
            if (
                search_engines.find(
                    (engine) =>
                        engine.engine_name ===
                        (interaction as ModalSubmitInteraction).fields.getTextInputValue('engine_name')
                )
            ) {
                await (interaction as StringSelectMenuInteraction).update({
                    embeds: [genPostEmbed('Engine already exists')],
                    components: [genMenuOptions()],
                });
                break;
            }

            search_engines.push(
                (() => {
                    const engine = new SearchEngines();
                    engine.engine_name = (interaction as ModalSubmitInteraction).fields.getTextInputValue(
                        'engine_name'
                    );
                    engine.engine_url = (interaction as ModalSubmitInteraction).fields.getTextInputValue('engine_url');
                    engine.from_guild = guild;
                    engine.from_user = user;
                    return engine;
                })()
            );

            await DatabaseConnection.manager.save(search_engines);
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            await RESTCommandLoader(guild.gid);
            break;
        }
        case '31': {
            if (!menu_path[1]) break;
            const selected = search_engines.find((engine) => engine.engine_name === menu_path[1]);

            await (interaction as StringSelectMenuInteraction).showModal(
                new ModalBuilder()
                    .setCustomId(`settings:search:22/${selected.engine_name}`)
                    .setTitle('Edit Engine')
                    .addComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                            engine_name.setValue(selected.engine_name)
                        ),
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                            engine_url.setValue(selected.engine_url.toString())
                        )
                    )
            );
            break;
        }
        case '32': {
            search_engines.find((engine) => engine.engine_name === menu_path[1]).engine_name = (
                interaction as ModalSubmitInteraction
            ).fields.getTextInputValue('engine_name');
            search_engines.find((engine) => engine.engine_name === menu_path[1]).engine_url = (
                interaction as ModalSubmitInteraction
            ).fields.getTextInputValue('engine_url');
            await DatabaseConnection.manager.save(search_engines);
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            await RESTCommandLoader(guild.gid);
            break;
        }
        case '41': {
            if (!menu_path[1]) break;

            const selected_engine = search_engines.find((engine) => engine.engine_name === menu_path[1]);
            search_engines.splice(
                search_engines.findIndex((engine) => engine.engine_name === menu_path[1]),
                1
            );
            await DatabaseConnection.manager.remove(selected_engine);

            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            await RESTCommandLoader(guild.gid);
            break;
        }
        default:
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
    }
};

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    try {
        const data = new SlashCommandBuilder().setName('search').setDescription('Search for something');
        const search_system = await DatabaseConnection.manager.findOne(Search, {
            where: { from_guild: { id: guild.id } },
        });
        const search_engines = await DatabaseConnection.manager.find(SearchEngines, {
            where: { from_guild: { id: guild.id } },
        });

        if (search_system) {
            if (!search_system.is_enabled) {
                return new SlashCommandBuilder().setName('search').setDescription('Search for something');
            }
        }

        if (search_engines.length === 0) {
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
                .addChoices(...search_engines.map((engine) => ({ name: engine.engine_name, value: engine.engine_url })))
        );
        data.addStringOption((option) => option.setName('query').setDescription('Search query').setRequired(true));
        return data;
    } catch (error) {
        Logger('error', error, guild);
        return new SlashCommandBuilder().setName('search').setDescription('Search for something');
    }
};

const exec = async (interaction: CommandInteraction) => {
    try {
        const engine = interaction.options.data.find((option) => option.name === 'engine')?.value || null;
        const query = interaction.options.data.find((option) => option.name === 'query')?.value || null;

        if (!engine || !query) {
            const post = new EmbedBuilder()
                .setTitle(':warning: Warning')
                .setDescription('Search is disabled. Please contact the server administrator.')
                .setColor(Colors.Yellow);
            await interaction.reply({
                embeds: [post],
                ephemeral: true,
            });
            return;
        }

        await interaction.reply(`${engine}${query.toString().replace(/\s+/g, '+')}`);
    } catch (error) {
        Logger('error', error, interaction);
    }
};

export default {
    enabled: true,
    name: 'search',
    type: 'customizable',
    description: 'Search for something',

    category: 'tools',
    cooldown: 5,
    usage: '/search',

    data: [scb],
    execute: exec,
    settings: settings,
} as Command_t;
