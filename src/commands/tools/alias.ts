import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    Events,
    Message,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { CommandLoader } from '..';
import { Aliases, AliasSystem } from '../../types/database/entities/alias';
import { Channels } from '../../types/database/entities/channels';
import { ChainEvent } from '../../types/decorator/chainevent';
import { HandleAction } from '../../types/decorator/command';
import { Log } from '../../types/decorator/log';
import { SettingGenericSettingComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

/**
 * A comprehensive command for creating and managing text-based aliases or macros.
 *
 * This command allows administrators to add, remove, modify, and list aliases.
 * An alias is a custom trigger word or phrase that, when detected in a message,
 * makes the bot respond with predefined content.
 *
 * The command features:
 * - Subcommands for full CRUD (Create, Read, Update, Delete) functionality: `/alias add`, `/alias remove`, `/alias modify`, and `/alias_list`.
 * - An event-driven listener (`onMessageCreate`) that scans messages for alias triggers.
 * - Dynamic content replacement with variables like `{{user}}`, `{{channel}}`, `{{mentioned_users}}`, etc.
 * - Configurable alias behavior, such as case-sensitivity and matching rules.
 * - A settings interface to enable or disable the entire system.
 */
export default class AliasCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'alias', is_admin_command: true, aliases: ['alias_list'] });

        (this.base_cmd_data as SlashCommandBuilder).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

        this.push_cmd_data = new SlashCommandBuilder()
            .setName('alias_list')
            .setDescription(this.t('subcommands.list.description'))
            .setNameLocalizations(this.getLocalizations('subcommands.list.name'))
            .setDescriptionLocalizations(this.getLocalizations('subcommands.list.description'));

        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setNameLocalizations(this.getLocalizations('subcommands.add.name'))
                .setDescription(this.t('subcommands.add.description'))
                .setDescriptionLocalizations(this.getLocalizations('subcommands.add.description'))
                .addStringOption((option) =>
                    option
                        .setName('alias_name')
                        .setDescription(this.t('parameters.alias_name.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.alias_name.name'))
                        .setDescriptionLocalizations(this.getLocalizations('parameters.alias_name.description'))
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('alias_content')
                        .setDescription(
                            this.t('parameters.alias_content.description', {
                                variables:
                                    '({{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})',
                            }),
                        )
                        .setNameLocalizations(this.getLocalizations('parameters.alias_content.name'))
                        .setDescriptionLocalizations(
                            this.getLocalizations('parameters.alias_content.description', {
                                variables:
                                    '({{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})',
                            }),
                        )
                        .setRequired(true),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('case_sensitive')
                        .setDescription(this.t('parameters.casesensitive.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.casesensitive.name'))
                        .setDescriptionLocalizations(this.getLocalizations('parameters.casesensitive.description'))
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('message_consists_only_of_word')
                        .setDescription(this.t('parameters.messageconsistsonlyofword.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.messageconsistsonlyofword.name'))
                        .setDescriptionLocalizations(
                            this.getLocalizations('parameters.messageconsistsonlyofword.description'),
                        )
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('message_includes_this_word')
                        .setDescription(this.t('parameters.messageincludesthisword.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.messageincludesthisword.name'))
                        .setDescriptionLocalizations(
                            this.getLocalizations('parameters.messageincludesthisword.description'),
                        )
                        .setRequired(false),
                ),
        );
        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription(this.t('subcommands.remove.description'))
                .setNameLocalizations(this.getLocalizations('subcommands.remove.name'))
                .setDescriptionLocalizations(this.getLocalizations('subcommands.remove.description'))
                .addStringOption((option) =>
                    option
                        .setName('alias_name')
                        .setDescription(this.t('parameters.alias_name.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.alias_name.name'))
                        .setDescriptionLocalizations(this.getLocalizations('parameters.alias_name.description'))
                        .setRequired(true),
                ),
        );

        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('modify')
                .setDescription(this.t('subcommands.modify.description'))
                .setNameLocalizations(this.getLocalizations('subcommands.modify.name'))
                .setDescriptionLocalizations(this.getLocalizations('subcommands.modify.description'))
                .addStringOption((option) =>
                    option
                        .setName('alias_name')
                        .setDescription(this.t('parameters.alias_name.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.alias_name.name'))
                        .setDescriptionLocalizations(this.getLocalizations('parameters.alias_name.description'))
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('alias_content')
                        .setDescription(
                            this.t('parameters.alias_content', {
                                variables:
                                    '({{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})',
                            }),
                        )
                        .setNameLocalizations(this.getLocalizations('parameters.alias_content.name'))
                        .setDescriptionLocalizations(
                            this.getLocalizations('parameters.alias_content.description', {
                                variables:
                                    '({{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})',
                            }),
                        )
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('case_sensitive')
                        .setDescription(this.t('parameters.casesensitive.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.casesensitive.name'))
                        .setDescriptionLocalizations(this.getLocalizations('parameters.casesensitive.description'))
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('message_consists_only_of_word')
                        .setDescription(this.t('parameters.messageconsistsonlyofword.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.messageconsistsonlyofword.name'))
                        .setDescriptionLocalizations(this.getLocalizations('parameters.messageconsistsonlyofword.description'))
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('message_includes_this_word')
                        .setDescription(this.t('parameters.messageincludesthisword.description'))
                        .setNameLocalizations(this.getLocalizations('parameters.messageincludesthisword.name'))
                        .setDescriptionLocalizations(this.getLocalizations('parameters.messageincludesthisword.description'))
                        .setRequired(false),
                ),
        );
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let alias_system = await this.db.findOne(AliasSystem, {
            where: { from_guild: { gid: guild!.gid } },
        });
        if (!alias_system) {
            alias_system = new AliasSystem();
            alias_system.is_enabled = false;
            alias_system.latest_action_from_user = system_user!;
            alias_system.from_guild = guild!;
            alias_system = await this.db.save(AliasSystem, alias_system);
            this.log.send('log', 'command.prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = alias_system.is_enabled;
        this.log.send('debug', 'command.prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * The main execution handler for the `/alias` and `/alias_list` commands.
     * It acts as a router, delegating the interaction to the appropriate subcommand handler.
     * @param interaction The chat input command interaction.
     */
    @Log()
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.commandName === 'alias_list') {
            await this.list(interaction);
        } else {
            await this[interaction.options.getSubcommand() as 'add' | 'remove' | 'modify'](interaction);
        }
    }

    /**
     * Handles the `/alias add` subcommand.
     * Creates a new alias with the specified properties and saves it to the database.
     * @param interaction The chat input command interaction for the `add` subcommand.
     */
    @Log()
    private async add(interaction: ChatInputCommandInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.subcommand.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'add',
        });
        const aliases = await this.db.find(Aliases, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });

        const alias_name = interaction.options.getString('alias_name');
        const alias_content = interaction.options.getString('alias_content');
        const case_sensitive = interaction.options.getBoolean('case_sensitive') ?? false;
        const consists_only_of_word = interaction.options.getBoolean('message_consists_only_of_word') ?? false;
        const includes_this_word = interaction.options.getBoolean('message_includes_this_word') ?? false;

        const existing_alias = aliases.find((alias) => alias.name === alias_name);
        if (existing_alias) {
            await interaction.reply({
                content: this.t('add.alias_exists', { alias: alias_name }, interaction),
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.alias.add.alias_exists', {
                guild: interaction.guild,
                user: interaction.user,
                alias: alias_name!,
            });
            return;
        }

        const new_alias = new Aliases();
        new_alias.name = alias_name!;
        new_alias.content = alias_content!;
        new_alias.case_sensitive = case_sensitive;
        new_alias.consists_only_of_word = consists_only_of_word;
        new_alias.includes_this_word = includes_this_word;
        new_alias.from_user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        new_alias.from_channel = (await this.db.findOne(Channels, {
            where: { cid: BigInt(interaction.channelId) },
        }))!;
        new_alias.from_guild = (await this.db.getGuild(BigInt(interaction.guildId!)))!;
        await this.db.save(Aliases, new_alias);
        await interaction.reply({
            content: this.t('add.success', { alias: alias_name }, interaction),
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.alias.add.alias_created', {
            guild: interaction.guild,
            user: interaction.user,
            alias: alias_name!,
        });
        this.log.send('debug', 'command.execute.subcommand.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'add',
        });
    }

    /**
     * Handles the `/alias remove` subcommand.
     * Deletes an alias from the database based on its name.
     * @param interaction The chat input command interaction for the `remove` subcommand.
     */
    @Log()
    private async remove(interaction: ChatInputCommandInteraction): Promise<void> {
        const alias_name = interaction.options.getString('alias_name')!;
        this.log.send('debug', 'command.execute.subcommand.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'remove',
        });
        const alias = await this.db.findOne(Aliases, {
            where: { name: alias_name, from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        if (!alias) {
            await interaction.reply({
                content: this.t('alias_not_found', { alias: alias_name }, interaction),
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.alias.remove.alias_not_found', {
                guild: interaction.guild,
                user: interaction.user,
                alias_name: alias_name,
            });
            return;
        }

        await this.db.remove(Aliases, alias);
        await interaction.reply({
            content: this.t('remove.success', { alias: alias_name }, interaction),
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.execute.subcommand.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'remove',
        });
    }

    /**
     * Handles the `/alias_list` command and the "List" button in the settings UI.
     * Fetches all aliases for the guild and displays them in a paginated embed.
     * @param interaction The interaction from the command or button.
     */
    @Log()
    private async list(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.subcommand.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'list',
        });
        const aliases = await this.db.find(Aliases, {
            where: { from_guild: { gid: BigInt(interaction.guild!.id) } },
        });
        if (aliases.length === 0) {
            await interaction.reply({
                content: this.t('list.no_aliases', undefined, interaction),
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.alias.list.no_aliases', {
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }

        const payload = await this.paginator.generatePage(interaction.guild!.id, interaction.user.id, this.name, {
            title: `:notepad_spiral: ${this.t('list.title', undefined, interaction)}`,
            color: 0x00ffff,
            items: aliases
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((alias) => ({
                    name: alias.name,
                    pretty_name: alias.name,
                    description: alias.content.match(/^https?:\/\/.+$/)
                        ? `[Link](${alias.content})`
                        : `\`\`\`${alias.content.substring(0, 97) + (alias.content.length > 100 ? '...' : '')}\`\`\``,
                    namespace: 'command' as const,
                })),
            items_per_page: 5,
            enable_select_menu_descriptions: false,
        });

        if (interaction.isButton()) {
            await interaction.update({
                embeds: payload.embeds,
                components: payload.components,
            });
            return;
        }
        await interaction.reply({
            embeds: payload.embeds,
            components: payload.components,
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.execute.subcommand.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'list',
        });
    }

    /**
     * Handles the `/alias modify` subcommand.
     * Updates the properties of an existing alias.
     * @param interaction The chat input command interaction for the `modify` subcommand.
     */
    @Log()
    private async modify(interaction: ChatInputCommandInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.subcommand.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'modify',
        });
        const alias_name = interaction.options.getString('alias_name')!;
        const alias_content = interaction.options.getString('alias_content');
        const case_sensitive = interaction.options.getBoolean('case_sensitive');
        const consists_only_of_word = interaction.options.getBoolean('message_consists_only_of_word');
        const includes_this_word = interaction.options.getBoolean('message_includes_this_word');

        const alias = await this.db.findOne(Aliases, {
            where: { name: alias_name, from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        if (!alias) {
            await interaction.reply({
                content: this.t('alias_not_found', { alias: alias_name }, interaction),
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.alias.modify.alias_not_found', {
                guild: interaction.guild,
                user: interaction.user,
                alias: alias_name,
            });
            return;
        }

        if (alias_content !== null && alias_content.length > 0) alias.content = alias_content;
        if (case_sensitive !== null) alias.case_sensitive = case_sensitive;
        if (consists_only_of_word !== null) alias.consists_only_of_word = consists_only_of_word;
        if (includes_this_word !== null) alias.includes_this_word = includes_this_word;
        await this.db.save(Aliases, alias);
        await interaction.reply({
            content: this.t('modify.success', { alias: alias_name }, interaction),
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.execute.subcommand.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'modify',
        });
    }

    /**
     * Handles the interaction when a user selects an item from the paginated alias list.
     * Displays a detailed view of the selected alias's properties.
     * @param interaction The button interaction from the paginator.
     * @param item_name The name of the selected alias.
     */
    @HandleAction('pageitem')
    @Log()
    public async handlePageItem(interaction: ButtonInteraction, item_name: string): Promise<void> {
        this.log.send('debug', 'command.handlePageItem.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        const alias = await this.db.findOne(Aliases, {
            where: { name: item_name, from_guild: { gid: BigInt(interaction.guild!.id) } },
        });
        const payload = await this.paginator.viewPage(interaction.guild!.id, interaction.user.id, this.name, {
            title: `:notepad_spiral: ${alias!.name}`,
            color: 0x00ffff,
            description: `
                **${this.t('handlepageitem.name', undefined, interaction)}:** \`${alias!.name}\`
                **${this.t('handlepageitem.content', undefined, interaction)}:**\n\`\`\`${alias!.content}\`\`\`
                **${this.t('handlepageitem.casesensitive', undefined, interaction)}:** ${alias!.case_sensitive ? `:green_circle: ${this.t('command.execute.true', undefined, interaction)}` : `:red_circle: ${this.t('command.execute.false', undefined, interaction)}`}
                **${this.t('handlepageitem.messageconsistsonlyofword', undefined, interaction)}:** ${alias!.consists_only_of_word ? `:green_circle: ${this.t('command.execute.true', undefined, interaction)}` : `:red_circle: ${this.t('command.execute.false', undefined, interaction)}`}
                **${this.t('handlepageitem.messageincludesthisword', undefined, interaction)}:** ${alias!.includes_this_word ? `:green_circle: ${this.t('command.execute.true', undefined, interaction)}` : `:red_circle: ${this.t('command.execute.false', undefined, interaction)}`}
            `,
        });
        await interaction.update({
            embeds: payload.embeds,
            components: payload.components,
        });
        this.log.send('debug', 'command.handlePageItem.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
    }

    /**
     * The core logic that triggers aliases.
     * This method is decorated with `@ChainEvent` to listen for the `MessageCreate` event.
     * It scans the content of every non-bot message, checks if it matches any defined alias
     * based on its rules, and if so, sends the alias's content as a reply.
     * @param message The message that triggered the event.
     */
    @ChainEvent({ type: Events.MessageCreate })
    @Log()
    public async onMessageCreate(message: Message<true>): Promise<void> {
        if (message.author.bot || !message.guild) return;
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'alias',
            event: 'onMessageCreate',
            guild: message.guild!,
            user: message.author,
        });

        const replace_table = [
            { key: '{{user}}', value: `<@${message.author.id}>` },
            { key: '{{user_id}}', value: message.author.id },
            { key: '{{channel}}', value: `<#${message.channel.id}>` },
            { key: '{{channel_id}}', value: message.channel.id },
            { key: '{{guild}}', value: message.guild!.name },
            { key: '{{guild_id}}', value: message.guild!.id },
            { key: '{{mentioned_users}}', value: '' },
        ];

        const aliases = await this.db.find(Aliases, {
            where: { from_guild: { gid: BigInt(message.guild!.id) } },
        });

        for (const alias of aliases) {
            let match = false;
            let message_content = message.content;
            let alias_name = alias.name;

            if (!alias.case_sensitive) {
                message_content = message_content.toLowerCase();
                alias_name = alias_name.toLowerCase();
            }
            if (alias.includes_this_word) {
                match = message_content.split(' ').includes(alias_name);
            } else if (alias.consists_only_of_word) {
                match = alias_name == message_content;
            } else {
                match = message_content.includes(alias_name);
            }

            if (match) {
                let reply_content = alias.content;
                const mentioned_users = message.mentions.users.map((user) => `<@${user.id}>`);
                if (message.reference) {
                    const replied_user = (await message.channel.messages.fetch(message.reference.messageId!)).author.id;
                    if (!mentioned_users.includes(`<@${replied_user}>`)) mentioned_users.push(`<@${replied_user}>`);
                }
                replace_table.find((item) => item.key === '{{mentioned_users}}')!.value = mentioned_users.join(', ');

                for (const item of replace_table) {
                    const regex = new RegExp(item.key, 'g');
                    reply_content = reply_content.replace(regex, item.value);
                }
                reply_content = reply_content.replace(/\\n/g, '\n');
                await message.channel.send(reply_content);
                this.log.send('debug', 'command.event.trigger.success', {
                    name: 'alias',
                    event: 'onMessageCreate',
                    guild: message.guild!,
                    user: message.author,
                });
            }
        }
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    /**
     * Toggles the alias system on or off for the guild.
     * When toggled, it reloads the slash command permissions for the guild.
     * @param interaction The interaction from the settings select menu.
     */
    @Log()
    @SettingGenericSettingComponent({
        database: AliasSystem,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
        const alias_system = await this.db.findOne(AliasSystem, {
            where: { from_guild: { gid: BigInt(interaction.guild!.id) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        alias_system!.is_enabled = !alias_system!.is_enabled;
        alias_system!.latest_action_from_user = user;
        alias_system!.timestamp = new Date();
        this.enabled = alias_system!.is_enabled;
        await this.db.save(AliasSystem, alias_system!);
        CommandLoader.RESTCommandLoader(this, interaction.guild!.id);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }
    // ================================================================ //
}
