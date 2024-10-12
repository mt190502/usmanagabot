import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    CommandInteraction,
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
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { RESTCommandLoader } from '../loader';

const settings = async (interaction: StringSelectMenuInteraction | ModalSubmitInteraction) => {
    try {
        const guild: Guilds = await DatabaseConnection.manager.findOne(Guilds, {
            where: { gid: BigInt(interaction.guild.id) },
        });
        const user: Users = await DatabaseConnection.manager.findOne(Users, {
            where: { uid: BigInt(interaction.user.id) },
        });
        const engines: Search[] = await DatabaseConnection.manager.find(Search, {
            where: { from_guild: { id: guild.id } },
        });

        const engine_name = new TextInputBuilder()
            .setCustomId('engine_name')
            .setLabel('Engine Name')
            .setStyle(TextInputStyle.Short);
        const engine_url = new TextInputBuilder()
            .setCustomId('engine_url')
            .setLabel('Engine URL')
            .setStyle(TextInputStyle.Short);

        const menu_path =
            interaction.type == 3
                ? (interaction as StringSelectMenuInteraction).values[0].split(':').at(-1).split('/')
                : (interaction as ModalSubmitInteraction).customId.split(':').at(-1).split('/');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('settings:search:0')
            .addOptions(
                { label: 'Add Engine', description: 'Add a new search engine', value: 'settings:search:1' },
                { label: 'Edit Engine', description: 'Edit an existing search engine', value: 'settings:search:2' },
                { label: 'Remove Engine', description: 'Remove an existing search engine', value: 'settings:search:3' },
                { label: 'Back', description: 'Go back to the previous menu', value: 'settings' }
            );
        const row = new ActionRowBuilder().addComponents(menu);

        if (engines.length === 0) {
            const default_engines = [
                { key: 'Google', value: 'https://google.com/search?q=' },
                { key: 'DuckDuckGo', value: 'https://duckduckgo.com/?q=' },
            ];
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
                await (interaction as StringSelectMenuInteraction).showModal(
                    new ModalBuilder()
                        .setCustomId('settings:search:11')
                        .setTitle('Add Engine')
                        .addComponents(
                            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(engine_name),
                            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(engine_url)
                        )
                );
                break;
            case '2':
                await (interaction as StringSelectMenuInteraction).update({
                    content: 'Select an engine to edit',
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder().setCustomId('settings:search:21').addOptions(
                                    ...engines.map((engine) => ({
                                        label: engine.engine_name,
                                        description: engine.engine_url.toString(),
                                        value: `settings:search:21/${engine.engine_name}`,
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
            case '3':
                await (interaction as StringSelectMenuInteraction).update({
                    content: 'Select an engine to remove',
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder().setCustomId('settings:search:31').addOptions(
                                    ...engines.map((engine) => ({
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
            case '11': {
                if (
                    engines.find(
                        (engine) =>
                            engine.engine_name ===
                            (interaction as ModalSubmitInteraction).fields.getTextInputValue('engine_name')
                    )
                ) {
                    await (interaction as StringSelectMenuInteraction).update('Engine already exists');
                    break;
                }

                const new_engine = new Search();
                new_engine.engine_name = (interaction as ModalSubmitInteraction).fields.getTextInputValue('engine_name');
                new_engine.engine_url = (interaction as ModalSubmitInteraction).fields.getTextInputValue('engine_url');
                new_engine.from_guild = guild;
                new_engine.from_user = user;
                await DatabaseConnection.manager
                    .save(new_engine)
                    .then(() => {
                        (interaction as StringSelectMenuInteraction).update('Engine added');
                    })
                    .catch((error) => {
                        console.error('Error adding engine:', error);
                        (interaction as StringSelectMenuInteraction).update('Error adding engine: ' + error);
                    });
                await RESTCommandLoader(guild.gid);
                break;
            }
            case '21': {
                if (!menu_path[1]) break;
                const selected = engines.find((engine) => engine.engine_name === menu_path[1]);

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
            case '22': {
                const edit_engine = await DatabaseConnection.manager.findOne(Search, {
                    where: { engine_name: menu_path[1] },
                });
                edit_engine.engine_name = (interaction as ModalSubmitInteraction).fields.getTextInputValue('engine_name');
                edit_engine.engine_url = (interaction as ModalSubmitInteraction).fields.getTextInputValue('engine_url');
                await DatabaseConnection.manager
                    .save(edit_engine)
                    .then(() => {
                        (interaction as StringSelectMenuInteraction).update({
                            content: 'Engine edited',
                            components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                        });
                    })
                    .catch((error) => {
                        console.error('Error editing engine:', error);
                        (interaction as StringSelectMenuInteraction).update('Error editing engine: ' + error);
                    });
                await RESTCommandLoader(guild.gid);
                break;
            }
            case '31': {
                if (!menu_path[1]) break;
                const remove_engine = await DatabaseConnection.manager.findOne(Search, {
                    where: { engine_name: menu_path[1] },
                });
                await DatabaseConnection.manager
                    .remove(remove_engine)
                    .then(() => {
                        (interaction as StringSelectMenuInteraction).update({
                            content: 'Engine removed',
                            components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                        });
                    })
                    .catch((error) => {
                        console.error('Error removing engine:', error);
                        (interaction as StringSelectMenuInteraction).update('Error removing engine: ' + error);
                    });
                await RESTCommandLoader(guild.gid);
                break;
            }
            default:
                await (interaction as StringSelectMenuInteraction).update({
                    content: 'Select an option',
                    components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
                });
                break;
        }
    } catch (error) {
        console.error('Error in settings function:', error);
        await interaction.reply('An error occurred while processing your request.');
    }
};

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    try {
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
    } catch (error) {
        console.error('Error in scb function:', error);
        throw new Error('Failed to build slash command');
    }
};

const exec = async (interaction: CommandInteraction) => {
    try {
        const engine = interaction.options.data.find((option) => option.name === 'engine')?.value;
        const query = interaction.options.data.find((option) => option.name === 'query')?.value;
        await interaction.reply(`${engine}${query.toString().replace(/\s+/g, '+')}`);
    } catch (error) {
        console.error('Error in exec function:', error);
        await interaction.reply('An error occurred while executing the command.');
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
