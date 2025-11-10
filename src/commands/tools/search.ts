import {
    ActionRowBuilder,
    ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    MessageFlags,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { CommandLoader } from '..';
import { Search, SearchEngines } from '../../types/database/entities/search';
import { CommandSetting } from '../../types/decorator/command';
import { CustomizableCommand } from '../../types/structure/command';

export default class SearchCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'search',
            pretty_name: 'Search',
            description: 'Search for information on a given topic.',
            cooldown: 5,
            help: `
                Search for information on a given topic.
                
                **Usage:**
                - \`/search [engine] query\` - Searches for the query using the specified search engine.
                
                **Examples:**
                - \`/search engine:google query:cats\`
                - \`/search engine:duckduckgo query:programming tutorials\`
            `,
        });
    }

    public async generateSlashCommandData(guild_id: bigint): Promise<void> {
        const guild = await this.db.getGuild(guild_id);
        const search = await this.db.findOne(Search, { where: { from_guild: guild! } });
        const engines = await this.db.find(SearchEngines, { where: { from_guild: guild! } });
        if (!search) return;
        this.enabled = search.is_enabled;
        const data: SlashCommandBuilder = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
        if (engines.length === 0) {
            data.addStringOption((o) =>
                o
                    .setName('engine')
                    .setDescription('Search engine')
                    .setRequired(true)
                    .addChoices({ name: 'Google', value: 'https://google.com/search?q=' })
                    .addChoices({ name: 'DuckDuckGo', value: 'https://duckduckgo.com/?q=' }),
            );
        } else {
            data.addStringOption((o) =>
                o
                    .setName('engine')
                    .setDescription('Search engine')
                    .setRequired(true)
                    .addChoices(...engines.map((engine) => ({ name: engine.engine_name, value: engine.engine_url }))),
            );
        }
        data.addStringOption((option) => option.setName('query').setDescription('Search query').setRequired(true));
        this.base_cmd_data = data;
    }
    // ================================================================ //

    // ============================ EXECUTE =========================== //
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const engine = interaction.options.data.find((option) => option.name === 'engine')?.value || null;
        const query = interaction.options.data.find((option) => option.name === 'query')?.value || null;

        if (!engine || !query) {
            const post = new EmbedBuilder()
                .setTitle(':warning: Warning')
                .setDescription('Search is disabled. Please contact the server administrator.')
                .setColor(Colors.Yellow);
            await interaction.reply({
                embeds: [post],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.reply(`${engine}${query.toString().replace(/\s+/g, '+')}`);
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    // -- Settings Components -- //
    private engine_name = new TextInputBuilder()
        .setCustomId('engine_name')
        .setLabel('Engine Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('DuckDuckGo');
    private engine_url = new TextInputBuilder()
        .setCustomId('engine_url')
        .setLabel('Engine URL')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://duckduckgo.com/?q=');
    // -- -- //

    @CommandSetting({
        display_name: 'Enabled',
        database_key: 'is_enabled',
        pretty: 'Toggle Search Command',
        description: 'Toggle the search command enabled/disabled.',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        const search = await this.db.findOne(Search, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        search!.is_enabled = !search!.is_enabled;
        this.enabled = search!.is_enabled;
        await this.db.save(Search, search!);
        CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
    }

    @CommandSetting({
        pretty: 'Add a New Search Engine',
        description: 'Add a new search engine to the list of available search engines.',
    })
    public async addEngine(interaction: StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
        const guild = await this.db.getGuild(BigInt(interaction.guildId!));
        const user = await this.db.getUser(BigInt(interaction.user.id));
        const engines = await this.db.find(SearchEngines, { where: { from_guild: guild! } });

        const engine_name = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(this.engine_name);
        const engine_url = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(this.engine_url);

        if (interaction.isModalSubmit()) {
            const name = interaction.fields.getTextInputValue('engine_name');
            const url = interaction.fields.getTextInputValue('engine_url');
            if (engines.find((e) => e.engine_name.toLowerCase() === name.toLowerCase())) {
                this.warning = `A search engine with the name \`${name}\` already exists.`;
                this.settingsUI(interaction);
                return;
            }
            const new_engine = new SearchEngines();
            new_engine.engine_name = name;
            new_engine.engine_url = url;
            new_engine.from_user = user!;
            new_engine.from_guild = guild!;
            await this.db.save(new_engine);
            CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
            await this.settingsUI(interaction);
            return;
        } else if (interaction.isStringSelectMenu()) {
            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId('settings:search:addengine')
                    .setTitle('Add Search Engine')
                    .addComponents([engine_name, engine_url]),
            );
        }
    }

    @CommandSetting({
        pretty: 'Edit Existing Search Engines',
        description: 'Edit an existing search engine from the list of available search engines.',
    })
    public async editEngine(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
        engine_name: string,
    ): Promise<void> {
        const guild = await this.db.getGuild(BigInt(interaction.guildId!));
        const user = await this.db.getUser(BigInt(interaction.user.id));
        const engines = await this.db.find(SearchEngines, { where: { from_guild: guild! } });

        console.log(interaction.customId, engine_name);

        if (interaction.isModalSubmit()) {
            const name = interaction.fields.getTextInputValue('engine_name');
            const url = interaction.fields.getTextInputValue('engine_url');
            const engine = engines.find((e) => e.engine_name === engine_name)!;
            engine.engine_name = name;
            engine.engine_url = url;
            engine.from_user = user!;
            engine.from_guild = guild!;
            await this.db.save(engine);
            CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
            await this.settingsUI(interaction);
            return;
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'settings:search') {
                await interaction.update({
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('settings:search:editengine')
                                .setPlaceholder('Select a search engine to edit')
                                .addOptions(
                                    ...engines.map((engine) => ({
                                        label: engine.engine_name,
                                        description: engine.engine_url,
                                        value: `settings:search:editengine:${engine.engine_name}`,
                                    })),
                                    {
                                        label: 'Cancel',
                                        description: 'Cancel editing search engines',
                                        value: 'settings:search',
                                    },
                                ),
                        ),
                    ],
                });
                return;
            } else if (interaction.customId.startsWith('settings:search:editengine')) {
                const engine_name_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                    this.engine_name.setValue(engines.find((e) => e.engine_name === engine_name)!.engine_name),
                );
                const engine_url_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                    this.engine_url.setValue(engines.find((e) => e.engine_name === engine_name)!.engine_url),
                );

                await interaction.showModal(
                    new ModalBuilder()
                        .setCustomId(`settings:search:editengine:${engine_name}`)
                        .setTitle(`Edit Search Engine: ${engine_name}`)
                        .addComponents([engine_name_input, engine_url_input]),
                );
                return;
            }
        }
    }

    @CommandSetting({
        pretty: 'Remove a Search Engine',
        description: 'Remove a search engine from the list of available search engines.',
    })
    public async removeEngine(interaction: StringSelectMenuInteraction, engine_name: string): Promise<void> {
        const guild = await this.db.getGuild(BigInt(interaction.guildId!));
        const engines = await this.db.find(SearchEngines, { where: { from_guild: guild! } });

        if (interaction.customId === 'settings:search') {
            await interaction.update({
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('settings:search:removeengine')
                            .setPlaceholder('Select a search engine to remove')
                            .addOptions(
                                ...engines.map((engine) => ({
                                    label: engine.engine_name,
                                    description: engine.engine_url,
                                    value: `settings:search:removeengine:${engine.engine_name}`,
                                })),
                                {
                                    label: 'Cancel',
                                    description: 'Cancel removing search engines',
                                    value: 'settings:search',
                                },
                            ),
                    ),
                ],
            });
            return;
        } else if (interaction.customId.startsWith('settings:search:removeengine')) {
            await this.db.remove(engines.find((e) => e.engine_name === engine_name)!);
            CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
            await this.settingsUI(interaction);
            return;
        }
    }

    public async settingsUI(
        interaction:
            | ChatInputCommandInteraction
            | ChannelSelectMenuInteraction
            | StringSelectMenuInteraction
            | ModalSubmitInteraction,
    ): Promise<void> {
        const guild = await this.db.getGuild(BigInt(interaction.guildId!));
        const user = await this.db.getUser(BigInt(interaction.user.id));
        let search = await this.db.findOne(Search, { where: { from_guild: guild! } });

        if (!search) {
            const new_settings = new Search();
            new_settings.is_enabled = true;
            new_settings.from_user = user!;
            new_settings.from_guild = guild!;

            const engine_google = new SearchEngines();
            engine_google.engine_name = 'Google';
            engine_google.engine_url = 'https://google.com/search?q=';
            engine_google.from_user = user!;
            engine_google.from_guild = guild!;

            const engine_duckduckgo = new SearchEngines();
            engine_duckduckgo.engine_name = 'DuckDuckGo';
            engine_duckduckgo.engine_url = 'https://duckduckgo.com/?q=';
            engine_duckduckgo.from_user = user!;
            engine_duckduckgo.from_guild = guild!;

            await this.db.save(engine_google);
            await this.db.save(engine_duckduckgo);
            search = await this.db.save(new_settings);
        }

        await this.buildSettingsUI(interaction, search);
    }
    // ================================================================ //
}
