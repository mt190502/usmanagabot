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
import { SettingGenericSettingComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class AliasCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'alias', is_admin_command: true, aliases: ['alias_list'] });
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        const aliases = await this.db.find(Aliases, { where: { from_guild: { gid: guild!.gid } } });
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

        const choices: { name: string; value: string }[] = [];
        for (const alias of aliases) {
            choices.push({ name: alias.name, value: alias.name });
        }

        this.base_cmd_data = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.t('description'))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

        this.push_cmd_data = new SlashCommandBuilder()
            .setName('alias_list')
            .setDescription(this.t('subcommands.list.description'));

        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription(this.t('subcommands.add.description'))
                .addStringOption((option) =>
                    option.setName('alias_name').setDescription(this.t('parameters.name')).setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('alias_content')
                        .setDescription(
                            this.t('parameters.content', {
                                variables:
                                    '({{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})',
                            }),
                        )
                        .setRequired(true),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('case_sensitive')
                        .setDescription(this.t('parameters.casesensitive'))
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('message_consists_only_of_word')
                        .setDescription(this.t('parameters.messageconsistsonlyofword'))
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option.setName('use_regex').setDescription(this.t('parameters.useregex')).setRequired(false),
                ),
        );
        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription(this.t('subcommands.remove.description'))
                .addStringOption((option) =>
                    option
                        .setName('alias_name')
                        .setDescription(this.t('parameters.name'))
                        .setRequired(true)
                ),
        );

        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('modify')
                .setDescription(this.t('subcommands.modify.description'))
                .addStringOption((option) =>
                    option
                        .setName('alias_name')
                        .setDescription(this.t('parameters.name'))
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('alias_content')
                        .setDescription(
                            this.t('parameters.content', {
                                variables:
                                    '({{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})',
                            }),
                        )
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('case_sensitive')
                        .setDescription(this.t('parameters.casesensitive'))
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('message_consists_only_of_word')
                        .setDescription(this.t('parameters.messageconsistsonlyofword'))
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option.setName('use_regex').setDescription(this.t('parameters.useregex')).setRequired(false),
                ),
        );
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        if (interaction.commandName === 'alias_list') {
            await this.list(interaction);
        } else {
            await this[interaction.options.getSubcommand() as 'add' | 'remove' | 'modify'](interaction);
        }

        this.log.send('debug', 'command.execute.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
    }

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
        const use_regex = interaction.options.getBoolean('use_regex') ?? false;

        const existing_alias = aliases.find((alias) => alias.name === alias_name);
        if (existing_alias) {
            await interaction.reply({
                content: this.t('add.alias_exists', { alias: alias_name }),
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
        new_alias.use_regex = use_regex;
        new_alias.from_user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        new_alias.from_channel = (await this.db.findOne(Channels, {
            where: { cid: BigInt(interaction.channelId) },
        }))!;
        new_alias.from_guild = (await this.db.getGuild(BigInt(interaction.guildId!)))!;
        await this.db.save(Aliases, new_alias);
        await interaction.reply({
            content: this.t('add.success', { alias: alias_name }),
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
                content: this.t('alias_not_found', { alias: alias_name }),
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
            content: this.t('remove.success', { alias: alias_name }),
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.execute.subcommand.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'remove',
        });
    }

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
                content: this.t('list.no_aliases'),
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.alias.list.no_aliases', {
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }

        const payload = await this.paginator.generatePage(interaction.guild!.id, interaction.user.id, this.name, {
            title: `:notepad_spiral: ${this.t('list.title')}`,
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

    @HandleAction('pageitem')
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
                **${this.t('handlepageitem.name')}:** \`${alias!.name}\`
                **${this.t('handlepageitem.content')}:**\n\`\`\`${alias!.content}\`\`\`
                **${this.t('handlepageitem.casesensitive')}:** ${alias!.case_sensitive ? `:green_circle: ${this.t('command.execute.true')}` : `:red_circle: ${this.t('command.execute.false')}`}
                **${this.t('handlepageitem.messageconsistsonlyofword')}:** ${alias!.consists_only_of_word ? `:green_circle: ${this.t('command.execute.true')}` : `:red_circle: ${this.t('command.execute.false')}`}
                **${this.t('handlepageitem.useregex')}:** ${alias!.use_regex ? `:green_circle: ${this.t('command.execute.true')}` : `:red_circle: ${this.t('command.execute.false')}`}
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
        const use_regex = interaction.options.getBoolean('use_regex');

        const alias = await this.db.findOne(Aliases, {
            where: { name: alias_name, from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        if (!alias) {
            await interaction.reply({
                content: this.t('alias_not_found', { alias: alias_name }),
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
        if (use_regex !== null) alias.use_regex = use_regex;
        await this.db.save(Aliases, alias);
        await interaction.reply({
            content: this.t('modify.success', { alias: alias_name }),
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.execute.subcommand.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'modify',
        });
    }

    @ChainEvent({ type: Events.MessageCreate })
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

            if (alias.use_regex) {
                const regex = new RegExp(alias_name, alias.case_sensitive ? 'g' : 'gi');
                if (alias.consists_only_of_word) {
                    const word_boundary_regex = new RegExp(`^${regex.source}$`, regex.flags);
                    match = word_boundary_regex.test(message_content);
                } else {
                    match = regex.test(message_content);
                }
            } else {
                if (alias.consists_only_of_word) {
                    match = alias_name == message_content;
                } else {
                    match = message_content.includes(alias_name);
                }
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
        CommandLoader.getInstance().RESTCommandLoader(this, interaction.guild!.id);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }
    // ================================================================ //
}
