import {
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
import { SettingToggleButtonComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class AliasCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'alias',
            pretty_name: 'Alias',
            description: 'Create an alias for keyword',
            is_admin_command: true,
            help: `
                Use this command to create, view, and manage command aliases for easier access.

                **Usage:**
                - \`/alias add <name> <content> <options>\` - Add a new alias.
                - \`/alias list\` - List all aliases for this server.
                - \`/alias modify <name> <content> <options>\` - Modify an existing alias.
                - \`/alias remove <name>\` - Remove an existing alias.
            `,
        });
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
            .setName('alias')
            .setDescription('Create an alias for keyword')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription('Add an alias')
                .addStringOption((option) => option.setName('alias_name').setDescription('Name').setRequired(true))
                .addStringOption((option) =>
                    option
                        .setName('alias_content')
                        .setDescription(
                            'Content (Variables: {{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})',
                        )
                        .setRequired(true),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('case_sensitive')
                        .setDescription('Whether the alias is case sensitive')
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('message_consists_only_of_word')
                        .setDescription('If the message consists only of the alias word')
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('use_regex')
                        .setDescription('Whether the alias uses regex for matching')
                        .setRequired(false),
                ),
        );
        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Remove an alias')
                .addStringOption((option) =>
                    option
                        .setName('alias_name')
                        .setDescription('Name')
                        .setRequired(true)
                        .setChoices(...choices),
                ),
        );

        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand
                .setName('modify')
                .setDescription('Modify an alias')
                .addStringOption((option) =>
                    option
                        .setName('alias_name')
                        .setDescription('Name')
                        .setRequired(true)
                        .setChoices(...choices),
                )
                .addStringOption((option) =>
                    option
                        .setName('alias_content')
                        .setDescription(
                            'Content (Variables: {{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})',
                        )
                        .setRequired(true),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('case_sensitive')
                        .setDescription('Whether the alias is case sensitive')
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('message_consists_only_of_word')
                        .setDescription('If the message consists only of the alias word')
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('use_regex')
                        .setDescription('Whether the alias uses regex for matching')
                        .setRequired(false),
                ),
        );

        (this.base_cmd_data as SlashCommandBuilder).addSubcommand((subcommand) =>
            subcommand.setName('list').setDescription('List all aliases'),
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
        this[interaction.options.getSubcommand() as 'add' | 'remove' | 'modify' | 'list'](interaction);
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
                content: `An alias with the name \`${alias_name}\` already exists.`,
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.alias.add.alias_exists', {
                guild: interaction.guild,
                user: interaction.user,
                alias_name: alias_name!,
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
        CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
        await interaction.reply({
            content: `Alias \`${alias_name}\` has been added.`,
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
                content: `No alias found with the name \`${alias_name}\`.`,
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
        CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
        await interaction.reply({
            content: `Alias \`${alias_name}\` has been removed.`,
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.execute.subcommand.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'remove',
        });
    }

    private async list(interaction: ChatInputCommandInteraction): Promise<void> {
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
                content: 'No aliases found for this server.',
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.alias.list.no_aliases', {
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }

        let reply_content = '**Aliases for this server:**\n';
        for (const alias of aliases) {
            reply_content += `- \`${alias.name}\`: ${alias.content}\n`;
        }

        await interaction.reply({
            content: reply_content,
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.execute.subcommand.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
            subcommand: 'list',
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
                content: `No alias found with the name \`${alias_name}\`.`,
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.alias.modify.alias_not_found', {
                guild: interaction.guild,
                user: interaction.user,
                alias_name: alias_name,
            });
            return;
        }

        alias.content = alias_content!;
        if (case_sensitive !== null) alias.case_sensitive = case_sensitive;
        if (consists_only_of_word !== null) alias.consists_only_of_word = consists_only_of_word;
        if (use_regex !== null) alias.use_regex = use_regex;
        await this.db.save(Aliases, alias);
        CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
        await interaction.reply({
            content: `Alias \`${alias_name}\` has been modified.`,
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
        if (message.author.bot) return;
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
    @SettingToggleButtonComponent({
        display_name: 'Enabled',
        database: AliasSystem,
        database_key: 'is_enabled',
        pretty: 'Toggle Alias System',
        description: 'Toggle the alias system enabled/disabled.',
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
