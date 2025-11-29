import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputStyle,
} from 'discord.js';
import { CommandLoader } from '..';
import { Search, SearchEngines } from '../../types/database/entities/search';
import { SettingGenericSettingComponent, SettingModalComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

/**
 * A highly customizable search command that allows users to query different search engines.
 *
 * This command is dynamically built based on the search engines configured for each guild.
 * Administrators can add, edit, and remove search engines through the command's settings UI.
 */
export default class SearchCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'search', cooldown: 5 });
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log('debug', 'prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        let search = await this.db.findOne(Search, { where: { from_guild: guild! } });
        const system_user = await this.db.getUser(BigInt(0));
        const engines = await this.db.find(SearchEngines, { where: { from_guild: guild! } });
        if (!search) {
            const new_settings = new Search();
            new_settings.is_enabled = true;
            new_settings.latest_action_from_user = system_user!;
            new_settings.from_guild = guild!;

            const engine_google = new SearchEngines();
            engine_google.engine_name = 'Google';
            engine_google.engine_url = 'https://google.com/search?q=';
            engine_google.latest_action_from_user = system_user!;
            engine_google.from_guild = guild!;

            const engine_duckduckgo = new SearchEngines();
            engine_duckduckgo.engine_name = 'DuckDuckGo';
            engine_duckduckgo.engine_url = 'https://duckduckgo.com/?q=';
            engine_duckduckgo.latest_action_from_user = system_user!;
            engine_duckduckgo.from_guild = guild!;

            await this.db.save(engine_google);
            await this.db.save(engine_duckduckgo);
            search = await this.db.save(new_settings);
            this.log('log', 'prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = search.is_enabled;

        const data = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.t.commands({ key: 'description', guild_id: BigInt(guild_id) }))
            .setNameLocalizations(this.getLocalizations('name'))
            .setDescriptionLocalizations(this.getLocalizations('description'));

        data.addStringOption((o) =>
            o
                .setName('engine')
                .setDescription(this.t.commands({ key: 'parameters.engine', guild_id: BigInt(guild_id) }))
                .setNameLocalizations(this.getLocalizations('parameters.engine.name'))
                .setDescriptionLocalizations(this.getLocalizations('parameters.engine.description'))
                .setRequired(true)
                .addChoices(...engines.map((engine) => ({ name: engine.engine_name, value: engine.engine_url }))),
        );

        data.addStringOption((option) =>
            option
                .setName('query')
                .setDescription(this.t.commands({ key: 'parameters.query', guild_id: BigInt(guild_id) }))
                .setNameLocalizations(this.getLocalizations('parameters.query.name'))
                .setDescriptionLocalizations(this.getLocalizations('parameters.query.description'))
                .setRequired(true),
        );

        this.base_cmd_data = data;
        this.log('debug', 'prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // ============================ EXECUTE =========================== //
    /**
     * Executes the search command.
     * It constructs a search URL from the chosen engine and the user's query and replies with it.
     * @param interaction The chat input command interaction.
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const engine = interaction.options.data.find((option) => option.name === 'engine')!.value;
        const query = interaction.options.data.find((option) => option.name === 'query')!.value;
        await interaction.reply(`${engine}${query!.toString().replace(/\s+/g, '+')}`);
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    /**
     * Toggles the search command on or off for the guild.
     * @param interaction The string select menu interaction from the settings UI.
     */
    @SettingGenericSettingComponent({
        database: Search,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log('debug', 'settings.toggle.start', { name: this.name, guild: interaction.guild });
        const search = await this.db.findOne(Search, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        search!.is_enabled = !search!.is_enabled;
        search!.latest_action_from_user = user;
        search!.timestamp = new Date();
        this.enabled = search!.is_enabled;
        await this.db.save(Search, search!);
        CommandLoader.RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    /**
     * Handles the submission of the "Add Engine" modal.
     * Creates a new search engine and saves it to the database.
     * @param interaction The modal submit interaction.
     */
    @SettingModalComponent({
        view_in_ui: false,
        inputs: [
            {
                id: 'engine_name',
                style: TextInputStyle.Short,
                required: true,
            },
            {
                id: 'engine_url',
                style: TextInputStyle.Short,
                required: true,
            },
        ],
    })
    public async addEngine(interaction: ModalSubmitInteraction): Promise<void> {
        this.log('debug', 'settings.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const guild = await this.db.getGuild(BigInt(interaction.guildId!));
        const user = await this.db.getUser(BigInt(interaction.user.id));
        const engines = await this.db.find(SearchEngines, { where: { from_guild: guild! } });

        const name = interaction.fields.getTextInputValue('engine_name');
        const url = interaction.fields.getTextInputValue('engine_url');
        if (engines.find((e) => e.engine_name.toLowerCase() === name.toLowerCase())) {
            this.warning = this.t.commands({
                key: 'settings.addengine.duplicate_engine',
                replacements: { name },
                guild_id: BigInt(interaction.guildId!),
            });
            this.log('warn', 'command.search.addengine.duplicate_engine', {
                name: this.name,
                guild: interaction.guild,
                user: interaction.user,
                engine_name: name,
            });
            await this.settingsUI(interaction);
            return;
        }
        if (!url.match(/^https?:\/\/.+/)) {
            this.warning = this.t.commands({
                key: 'settings.addengine.invalid_url',
                replacements: { url },
                guild_id: BigInt(interaction.guildId!),
            });
            this.log('warn', 'command.search.addengine.invalid_url', {
                name: this.name,
                guild: interaction.guild,
                user: interaction.user,
                url,
            });
            await this.settingsUI(interaction);
            return;
        }
        const new_engine = new SearchEngines();
        new_engine.engine_name = name;
        new_engine.engine_url = url;
        new_engine.latest_action_from_user = user!;
        new_engine.from_guild = guild!;
        new_engine.timestamp = new Date();
        await this.db.save(new_engine);
        CommandLoader.RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.modalsubmit.success', {
            name: this.name,
            guild: interaction.guild,
            engine_name: name,
        });
    }

    /**
     * Handles the submission of the "Edit Engine" modal.
     * Updates an existing search engine's details in the database.
     * @param interaction The modal submit interaction.
     * @param engine_name The original name of the engine being edited.
     */
    @SettingModalComponent({
        database: SearchEngines,
        database_key: 'engine_name',
        db_column_is_array: true,
        format_specifier: '%s',
        select_menu: {
            enable: true,
            label_key: 'engine_name',
            description_key: 'engine_url',
            include_cancel: true,
        },
        inputs: [
            {
                id: 'engine_name',
                database_key: 'engine_name',
                style: TextInputStyle.Short,
                required: true,
            },
            {
                id: 'engine_url',
                database_key: 'engine_url',
                style: TextInputStyle.Short,
                required: true,
            },
        ],
    })
    public async editEngine(interaction: ModalSubmitInteraction, engine_name: string): Promise<void> {
        this.log('debug', 'settings.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const guild = await this.db.getGuild(BigInt(interaction.guildId!));
        const user = await this.db.getUser(BigInt(interaction.user.id));
        const engines = await this.db.find(SearchEngines, { where: { from_guild: guild! } });

        const name = interaction.fields.getTextInputValue('engine_name');
        const url = interaction.fields.getTextInputValue('engine_url');
        const engine = engines.find((e) => e.engine_name === engine_name)!;

        if (!url.match(/^https?:\/\/.+/)) {
            this.warning = this.t.commands({
                key: 'settings.editengine.invalid_url',
                replacements: { url },
                guild_id: BigInt(interaction.guildId!),
            });
            this.log('warn', 'command.search.editengine.invalid_url', {
                name: this.name,
                guild: interaction.guild,
                user: interaction.user,
                url,
            });
            await this.settingsUI(interaction);
            return;
        }

        engine.engine_name = name;
        engine.engine_url = url;
        engine.latest_action_from_user = user!;
        engine.from_guild = guild!;
        engine.timestamp = new Date();

        await this.db.save(engine);
        CommandLoader.RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.modalsubmit.success', {
            name: this.name,
            guild: interaction.guild,
            engine_name: name,
        });
    }

    /**
     * Handles the "Remove Engine" setting.
     * It first displays a select menu listing all engines.
     * Upon selection, it removes the chosen engine from the database.
     * @param interaction The string select menu interaction.
     * @param engine_name The name of the engine selected for removal.
     */
    @SettingGenericSettingComponent({ view_in_ui: false })
    public async removeEngine(interaction: StringSelectMenuInteraction, engine_name: string): Promise<void> {
        this.log('debug', 'settings.selectmenu.start', { name: this.name, guild: interaction.guild });
        const guild = await this.db.getGuild(BigInt(interaction.guildId!));
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const search = await this.db.findOne(Search, { where: { from_guild: guild! } });
        const engines = await this.db.find(SearchEngines, { where: { from_guild: guild! } });

        if (interaction.customId === 'settings:search') {
            await interaction.update({
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('settings:search:removeengine')
                            .setPlaceholder(
                                this.t.commands({
                                    key: 'settings.removeengine.placeholder',
                                    guild_id: BigInt(interaction.guildId!),
                                }),
                            )
                            .addOptions(
                                ...engines.map((engine) => ({
                                    label: engine.engine_name,
                                    description: engine.engine_url,
                                    value: `settings:search:removeengine:${engine.engine_name}`,
                                })),
                                {
                                    label: this.t.system({
                                        caller: 'buttons',
                                        key: 'back',
                                        guild_id: BigInt(interaction.guildId!),
                                    }),
                                    description: this.t.system({
                                        caller: 'labels',
                                        key: 'backDescription',
                                        guild_id: BigInt(interaction.guildId!),
                                    }),
                                    value: 'settings:search',
                                },
                            ),
                    ),
                ],
            });
            return;
        } else if (interaction.customId.startsWith('settings:search:removeengine')) {
            await this.db.remove(engines.find((e) => e.engine_name === engine_name)!);
            CommandLoader.RESTCommandLoader(this, interaction.guildId!);
            search!.latest_action_from_user = user;
            search!.timestamp = new Date();
            await this.db.save(Search, search!);
            await this.settingsUI(interaction);
            this.log('debug', 'settings.selectmenu.success', { name: this.name, guild: interaction.guild });
            return;
        }
    }
    // ================================================================ //
}
