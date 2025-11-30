import {
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    ColorResolvable,
    Colors,
    EmbedBuilder,
    MessageFlags,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    TextInputStyle,
} from 'discord.js';
import 'reflect-metadata';
import yaml from 'yaml';
import { CommandLoader } from '..';
import { Introduction, IntroductionSubmit } from '../../types/database/entities/introduction';
import {
    SettingChannelMenuComponent,
    SettingGenericSettingComponent,
    SettingModalComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

/**
 * A highly customizable command for server member introductions.
 *
 * This command allows administrators to create a dynamic `/introduction` command where they can
 * define up to 8 custom questions (columns) for users to answer. The command name and description
 * are also customizable.
 *
 * Features:
 * - Dynamically generates slash command options based on YAML configuration.
 * - Stores user submissions and displays them in a designated channel.
 * - Automatically deletes a user's previous introduction post when they submit a new one.
 * - Includes rate-limiting to prevent spam.
 * - Fully configurable via the `/settings` command, with modals for customizing the command name,
 *   description, questions, and submission limits.
 */
export default class IntroductionCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'introduction', cooldown: 5 });
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log('debug', 'prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        const data = new SlashCommandBuilder().setName(this.name).setDescription(this.description);
        data.setNameLocalizations(this.getLocalizations('name')).setDescriptionLocalizations(
            this.getLocalizations('description'),
        );
        let introduction = await this.db.findOne(Introduction, { where: { from_guild: guild! } });
        if (!introduction) {
            const new_settings = new Introduction();
            new_settings.is_enabled = false;
            new_settings.from_guild = guild!;
            new_settings.latest_action_from_user = system_user!;
            introduction = await this.db.save(new_settings);
            this.log('log', 'prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = introduction.is_enabled;
        for (let i = 1; i <= 8; i++) {
            const column_name = `col${i}`;
            const [opt_name, opt_value] = (introduction[column_name as keyof Introduction] as [string, string]) || [];
            if (!opt_name && !opt_value) continue;
            data.addStringOption((option) =>
                option.setName(opt_name || `col${i}`).setDescription(opt_value || `<missing> ${i}`),
            );
        }
        this.base_cmd_data = data;
        this.log('debug', 'prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * Executes the introduction submission process.
     *
     * This method handles the logic when a user runs the command. It performs:
     * 1. Rate-limiting checks based on daily submission limits.
     * 2. Validation to ensure the command is configured and the user provides at least one answer.
     * 3. Gathers all provided answers and formats them into an embed.
     * 4. Appends standard user account information (creation date, join date, roles).
     * 5. Posts the new introduction to the designated channel and deletes the user's previous one.
     * 6. Saves the submission details to the database for future use (e.g., re-populating fields).
     *
     * @param interaction The `ChatInputCommandInteraction` from the user.
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guild = await this.db.getGuild(BigInt(interaction.guildId!));
        const user = await this.db.getUser(BigInt(interaction.user.id));
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: guild! },
        });
        const last_introduction_submit_from_user =
            (await this.db.findOne(IntroductionSubmit, {
                where: {
                    from_guild: guild!,
                    from_user: user!,
                },
            })) || new IntroductionSubmit();

        const post = new EmbedBuilder();

        const now_timestamp = new Date().getTime();
        const last_submit_timestamp = last_introduction_submit_from_user.timestamp
            ? last_introduction_submit_from_user.timestamp.getTime()
            : 0;
        const diff_timestamp = now_timestamp - last_submit_timestamp;
        const end_timestamp = (now_timestamp + 86400000 - diff_timestamp) / 1000;

        if (
            diff_timestamp < 86400000 &&
            diff_timestamp >= 3600 &&
            last_introduction_submit_from_user.hourly_submit_count === introduction!.daily_submit_limit
        ) {
            const msg = this.t.commands({
                key: 'execute.rate_limited',
                replacements: {
                    date: `<t:${Math.floor(end_timestamp)}:F>`,
                },
                guild_id: BigInt(interaction.guildId!),
            });
            post.setTitle(
                `:warning: ${this.t.system({ caller: 'messages', key: 'warning', guild_id: BigInt(interaction.guildId!) })}`,
            )
                .setDescription(msg)
                .setColor(Colors.Red);
            await interaction.reply({
                embeds: [post],
                flags: MessageFlags.Ephemeral,
            });
            this.log('warn', 'introduction.execute.rate_limited', {
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }

        last_introduction_submit_from_user.hourly_submit_count =
            now_timestamp - last_submit_timestamp > 86400000
                ? 1
                : last_introduction_submit_from_user.hourly_submit_count + 1;

        if (!introduction!.is_enabled || !introduction!.channel_id) {
            post.setTitle(
                `:warning: ${this.t.system({ caller: 'messages', key: 'warning', guild_id: BigInt(interaction.guildId!) })}`,
            )
                .setDescription(
                    this.t.commands({ key: 'execute.not_configured', guild_id: BigInt(interaction.guildId!) }),
                )
                .setColor(Colors.Red);
            await interaction.reply({
                embeds: [post],
                flags: MessageFlags.Ephemeral,
            });
            this.log('warn', 'configuration.missing', { name: this.name, guild: interaction.guild });
            return;
        }

        const user_roles = interaction
            .guild!.members.cache.get(interaction.user.id)!
            .roles.cache.sort((a, b) => b.position - a.position);
        const data: string[] = [
            `**__${this.t.commands({ key: 'execute.header', replacements: { user: interaction.user.username }, guild_id: BigInt(interaction.guildId!) })}__**\n`,
        ];

        let values = 0;
        for (let i = 1; i <= 8; i++) {
            const key = introduction![`col${i}` as keyof Introduction];
            if (Array.isArray(key)) {
                const value =
                    interaction.options.getString(key[0]) ||
                    (last_introduction_submit_from_user[`col${i}` as keyof IntroductionSubmit] as string) ||
                    null;
                if (value && value.length > 0 && key[1]) {
                    data.push(`**${key[1]}**: ${value}\n`);
                    (last_introduction_submit_from_user[`col${i}` as keyof IntroductionSubmit] as string) = value;
                    values++;
                }
            }
        }

        if (values === 0) {
            post.setTitle(
                `:warning: ${this.t.system({ caller: 'messages', key: 'warning', guild_id: BigInt(interaction.guildId!) })}`,
            )
                .setDescription(
                    this.t.commands({ key: 'execute.validation_failed', guild_id: BigInt(interaction.guildId!) }),
                )
                .setColor(Colors.Red);
            await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
            this.log('debug', 'execute.validation_failed', {
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }

        data.push(
            `\n**__${this.t.commands({ key: 'execute.account_info', guild_id: BigInt(interaction.guildId!) })}__**\n`,
            `**${this.t.commands({ key: 'execute.username', guild_id: BigInt(interaction.guildId!) })}**: ${interaction.user.username}\n`,
            `**${this.t.commands({ key: 'execute.nickname', guild_id: BigInt(interaction.guildId!) })}**: <@!${interaction.user.id}>\n`,
            `**${this.t.commands({ key: 'execute.id', guild_id: BigInt(interaction.guildId!) })}**: ${interaction.user.id}\n`,
            `**${this.t.commands({ key: 'execute.created_at', guild_id: BigInt(interaction.guildId!) })}**: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>\n`,
            `**${this.t.commands({ key: 'execute.joined_at', guild_id: BigInt(interaction.guildId!) })}**: <t:${Math.floor(interaction.guild!.members.cache.get(interaction.user.id)!.joinedTimestamp! / 1000)}:R>\n`,
            `**${this.t.commands({ key: 'execute.roles', guild_id: BigInt(interaction.guildId!) })}**: ${
                user_roles
                    .filter((r) => r.name !== '@everyone')
                    .map((r) => `<@&${r.id}>`)
                    .join(', ') || this.t.commands({ key: 'execute.no_roles', guild_id: BigInt(interaction.guildId!) })
            }\n`,
        );

        const color = user_roles.map((r) => r.hexColor).find((c) => c !== '#000000') as ColorResolvable;
        const embed = new EmbedBuilder()
            .setDescription(data.join(''))
            .setColor(color || 'Random')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();
        if (last_submit_timestamp) {
            embed.setFooter({
                text: this.t.commands({ key: 'execute.updated', guild_id: BigInt(interaction.guildId!) }),
            });
        }

        const target_channel = interaction.guild!.channels.cache.get(introduction!.channel_id) as TextChannel;
        const publish = await target_channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });
        this.log('debug', 'execute.published', {
            messageId: publish.id,
            guild: interaction.guild,
            user: interaction.user,
        });
        if (last_introduction_submit_from_user.last_submit_id) {
            const old_message = await target_channel.messages
                .fetch(last_introduction_submit_from_user.last_submit_id.toString())
                .catch(() => null);
            if (old_message) {
                await old_message.delete();
                this.log('debug', 'execute.deleted', {
                    messageId: old_message.id,
                    guild: interaction.guild,
                    user: interaction.user,
                });
            }
        }

        last_introduction_submit_from_user.last_submit_id = BigInt(publish.id);
        last_introduction_submit_from_user.timestamp = new Date();
        last_introduction_submit_from_user.from_user = user!;
        last_introduction_submit_from_user.from_guild = guild!;
        await this.db.save(last_introduction_submit_from_user);

        post.setTitle(
            `:white_check_mark: ${this.t.system({ caller: 'messages', key: 'success', guild_id: BigInt(interaction.guildId!) })}`,
        )
            .setColor(Colors.Green)
            .setDescription(
                this.t.commands({
                    key: 'execute.submission_successful',
                    replacements: {
                        remaining:
                            introduction!.daily_submit_limit - last_introduction_submit_from_user.hourly_submit_count,
                        url: publish.url,
                    },
                    guild_id: BigInt(interaction.guildId!),
                }),
            );
        await interaction.reply({
            embeds: [post],
            flags: MessageFlags.Ephemeral,
        });
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    /**
     * Toggles the introduction system on or off for the guild.
     * @param interaction The interaction from the settings UI.
     */
    @SettingGenericSettingComponent({
        database: Introduction,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log('debug', 'settings.toggle.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        introduction!.is_enabled = !introduction!.is_enabled;
        introduction!.latest_action_from_user = user;
        introduction!.timestamp = new Date();
        this.enabled = introduction!.is_enabled;
        await this.db.save(Introduction, introduction!);
        CommandLoader.RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    /**
     * Customizes the questions (columns) for the introduction command.
     *
     * This setting opens a modal where an administrator can provide a YAML-formatted
     * string to define the slash command options. It validates against duplicate names
     * and rebuilds the command with the new structure.
     *
     * @param interaction The interaction from the modal submission.
     */
    @SettingModalComponent({
        view_in_ui: false,
        database: Introduction,
        inputs: [
            {
                id: 'column_names',
                database_key: 'yaml_data',
                style: TextInputStyle.Paragraph,
                required: true,
            },
        ],
    })
    public async customizeColumns(interaction: ModalSubmitInteraction): Promise<void> {
        this.log('debug', 'settings.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const name_set = new Set<string>();
        const columns = interaction.fields.getTextInputValue('column_names');
        const parsed = yaml.parse(columns);
        if (parsed.length > 8) {
            this.warning = this.t.commands({
                key: 'settings.customizecolumns.too_many_columns',
                guild_id: BigInt(interaction.guildId!),
            });
            this.log('warn', 'settings.validation_failed', {
                guild: interaction.guild,
                user: interaction.user,
            });
            await this.settingsUI(interaction);
            return;
        }
        for (const column of parsed) {
            if (name_set.has(column.name)) {
                this.warning = this.t.commands({
                    key: 'settings.customizecolumns.duplicated',
                    replacements: { column: column.name },
                    guild_id: BigInt(interaction.guildId!),
                });
                this.log('warn', 'settings.validation_failed', {
                    guild: interaction.guild,
                    user: interaction.user,
                });
                await this.settingsUI(interaction);
                return;
            }
            name_set.add(column.name);
        }
        for (let i = 0; i < 8; i++) {
            if (!parsed[i]) parsed[i] = { name: null, value: null };
            (introduction![`col${i + 1}` as keyof Introduction] as string[]) = [parsed[i].name, parsed[i].value];
        }
        introduction!.yaml_data = columns;
        introduction!.latest_action_from_user = user;
        introduction!.timestamp = new Date();
        await this.db.save(Introduction, introduction!);
        CommandLoader.RESTCommandLoader(this, interaction.guildId!);
        await interaction.deferUpdate();
        this.log('debug', 'settings.modalsubmit.success', {
            name: this.name,
            guild: interaction.guild,
        });
    }

    /**
     * Sets the daily submission limit for the introduction command.
     * This prevents users from spamming introduction updates.
     * @param interaction The interaction from the modal submission.
     */
    @SettingModalComponent({
        database: Introduction,
        database_key: 'daily_submit_limit',
        format_specifier: '`%s`',
        inputs: [
            {
                id: 'daily_limit',
                database_key: 'daily_submit_limit',
                style: TextInputStyle.Short,
                max_length: 3,
            },
        ],
    })
    public async setDailySubmissionLimit(interaction: ModalSubmitInteraction): Promise<void> {
        this.log('debug', 'settings.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const limit_value = interaction.fields.getTextInputValue('daily_limit');
        const limit = parseInt(limit_value, 10);
        if (isNaN(limit) || limit < 1 || limit > 100) {
            this.warning = this.t.commands({
                key: 'settings.setdailysubmissionlimit.limit_range',
                guild_id: BigInt(interaction.guildId!),
            });
            this.log('warn', 'settings.validation_failed', {
                guild: interaction.guild,
                user: interaction.user,
            });
            await this.settingsUI(interaction);
            return;
        }
        introduction!.daily_submit_limit = limit;
        introduction!.latest_action_from_user = user;
        introduction!.timestamp = new Date();
        await this.db.save(Introduction, introduction!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.modalsubmit.success', {
            name: this.name,
            guild: interaction.guild,
        });
    }

    /**
     * Sets the channel where completed introductions will be posted.
     * @param interaction The interaction from the settings UI.
     */
    @SettingChannelMenuComponent({
        database: Introduction,
        database_key: 'channel_id',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
        },
    })
    public async changeTargetChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
        this.log('debug', 'settings.channel.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const selected_channel = interaction.values[0];
        introduction!.channel_id = selected_channel;
        introduction!.latest_action_from_user = user;
        introduction!.timestamp = new Date();
        await this.db.save(Introduction, introduction!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.channel.success', {
            name: this.name,
            guild: interaction.guild,
            channel: selected_channel,
        });
    }
    // ================================================================ //
}
