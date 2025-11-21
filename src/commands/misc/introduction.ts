import {
    ActionRowBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    ColorResolvable,
    Colors,
    EmbedBuilder,
    MessageFlags,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import 'reflect-metadata';
import yaml from 'yaml';
import { CommandLoader } from '..';
import { Introduction, IntroductionSubmit } from '../../types/database/entities/introduction';
import { SettingChannelMenuComponent, SettingGenericSettingComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class IntroductionCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'introduction', cooldown: 5 });
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let introduction = await this.db.findOne(Introduction, { where: { from_guild: guild! } });
        if (!introduction) {
            const new_settings = new Introduction();
            new_settings.is_enabled = false;
            new_settings.cmd_name = this.name;
            new_settings.cmd_desc = this.description;
            new_settings.from_guild = guild!;
            new_settings.latest_action_from_user = system_user!;
            introduction = await this.db.save(new_settings);
            this.log.send('log', 'command.prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = introduction.is_enabled;
        const data: SlashCommandBuilder = new SlashCommandBuilder().setName(this.name);
        data.setDescription(introduction.cmd_desc || this.description).setNameLocalization(
            guild!.country,
            introduction.cmd_name,
        );
        for (let i = 1; i <= 8; i++) {
            const column_name = `col${i}`;
            const [opt_name, opt_value] = (introduction[column_name as keyof Introduction] as [string, string]) || [];
            if (!opt_name && !opt_value) continue;
            data.addStringOption((option) =>
                option.setName(opt_name || `col${i}`).setDescription(opt_value || `<missing> ${i}`),
            );
        }
        this.base_cmd_data = data;
        this.log.send('debug', 'command.prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
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
            const msg = this.t('introduction.execute.rate_limited', {
                date: `<t:${Math.floor(end_timestamp)}:F>`,
            });
            post.setTitle(`:warning: ${this.t('command.execute.warning')}`)
                .setDescription(msg)
                .setColor(Colors.Red);
            await interaction.reply({
                embeds: [post],
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.introduction.execute.rate_limited', {
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
            post.setTitle(`:warning: ${this.t('command.execute.warning')}`)
                .setDescription(this.t('introduction.execute.not_configured'))
                .setColor(Colors.Red);
            await interaction.reply({
                embeds: [post],
                flags: MessageFlags.Ephemeral,
            });
            this.log.send('warn', 'command.configuration.missing', { name: this.name, guild: interaction.guild });
            return;
        }

        const user_roles = interaction
            .guild!.members.cache.get(interaction.user.id)!
            .roles.cache.sort((a, b) => b.position - a.position);
        const data: string[] = [`**__${this.t('introduction.execute.header', { user: interaction.user.username })}__**\n`];

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
            post.setTitle(`:warning: ${this.t('command.execute.warning')}`)
                .setDescription(this.t('introduction.execute.validation_failed'))
                .setColor(Colors.Red);
            await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
            this.log.send('debug', 'command.introduction.execute.validation.failed', {
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }

        data.push(
            `\n**__${this.t('introduction.execute.account_info')}__**\n`,
            `**${this.t('introduction.execute.username')}**: ${interaction.user.username}\n`,
            `**${this.t('introduction.execute.nickname')}**: <@!${interaction.user.id}>\n`,
            `**${this.t('introduction.execute.id')}**: ${interaction.user.id}\n`,
            `**${this.t('introduction.execute.created_at')}**: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>\n`,
            `**${this.t('introduction.execute.joined_at')}**: <t:${Math.floor(interaction.guild!.members.cache.get(interaction.user.id)!.joinedTimestamp! / 1000)}:R>\n`,
            `**${this.t('introduction.execute.roles')}**: ${
                user_roles
                    .filter((r) => r.name !== '@everyone')
                    .map((r) => `<@&${r.id}>`)
                    .join(', ') || this.t('introduction.execute.no_roles')
            }\n`,
        );

        const color = user_roles.map((r) => r.hexColor).find((c) => c !== '#000000') as ColorResolvable;
        const embed = new EmbedBuilder()
            .setDescription(data.join(''))
            .setColor(color || 'Random')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();
        if (last_submit_timestamp) embed.setFooter({ text: this.t('introduction.execute.updated') });

        const target_channel = interaction.guild!.channels.cache.get(introduction!.channel_id) as TextChannel;
        const publish = await target_channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });
        this.log.send('debug', 'command.introduction.execute.published', {
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
                this.log.send('debug', 'command.introduction.execute.deleted', {
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

        post.setTitle(`:white_check_mark: ${this.t('command.execute.success')}`)
            .setColor(Colors.Green)
            .setDescription(
                this.t('introduction.execute.submission_successful', {
                    remaining: introduction!.daily_submit_limit - last_introduction_submit_from_user.hourly_submit_count,
                    url: publish.url,
                }),
            );
        await interaction.reply({
            embeds: [post],
            flags: MessageFlags.Ephemeral,
        });
        this.log.send('debug', 'command.execute.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @SettingGenericSettingComponent({
        database: Introduction,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        introduction!.is_enabled = !introduction!.is_enabled;
        introduction!.latest_action_from_user = user;
        introduction!.timestamp = new Date();
        this.enabled = introduction!.is_enabled;
        await this.db.save(Introduction, introduction!);
        CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    @SettingGenericSettingComponent({ view_in_ui: false })
    public async customizeCommand(interaction: StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const cmd_name = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('cmd_name')
                .setLabel(this.t('introduction.settings.customizecommand.parameters.command_name'))
                .setValue(introduction!.cmd_name)
                .setStyle(TextInputStyle.Short)
                .setRequired(false),
        );
        const cmd_desc = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('cmd_desc')
                .setLabel(this.t('introduction.settings.customizecommand.parameters.command_description'))
                .setValue(introduction!.cmd_desc)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false),
        );
        if (interaction.isModalSubmit()) {
            const new_cmd_name = interaction.fields.getTextInputValue('cmd_name');
            const new_cmd_desc = interaction.fields.getTextInputValue('cmd_desc');
            if (new_cmd_name) introduction!.cmd_name = new_cmd_name;
            if (new_cmd_desc) introduction!.cmd_desc = new_cmd_desc;
            introduction!.latest_action_from_user = user;
            introduction!.timestamp = new Date();
            await this.db.save(Introduction, introduction!);
            CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
            await interaction.deferUpdate();
            this.log.send('debug', 'command.setting.modalsubmit.success', {
                name: this.name,
                guild: interaction.guild,
            });
            return;
        } else if (interaction.isStringSelectMenu()) {
            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId('settings:introduction:customizecommand')
                    .setTitle(this.t('introduction.settings.customizecommand.pretty_name'))
                    .addComponents([cmd_name, cmd_desc]),
            );
        }
    }

    @SettingGenericSettingComponent({ view_in_ui: false })
    public async customizeColumns(interaction: StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        if (interaction.isModalSubmit()) {
            const name_set = new Set<string>();
            const columns = interaction.fields.getTextInputValue('column_names');
            let parsed = yaml.parse(columns);
            if (parsed.length > 8) {
                parsed = parsed.slice(0, 8);
            }
            for (const column of parsed) {
                if (name_set.has(column.name)) {
                    this.warning = this.t('introduction.settings.customizecolumns.duplicated', { column: column.name });
                    this.log.send('warn', 'command.introduction.setting.validation.failed', {
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
            CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
            await interaction.deferUpdate();
            this.log.send('debug', 'command.setting.modalsubmit.success', {
                name: this.name,
                guild: interaction.guild,
            });
        }
        if (interaction.isStringSelectMenu()) {
            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId('settings:introduction:customize_columns')
                    .setTitle(this.t('introduction.settings.customizecolumns.pretty_name'))
                    .addComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                            new TextInputBuilder()
                                .setCustomId('column_names')
                                .setLabel(this.t('introduction.settings.customizecolumns.parameters.column_names'))
                                .setPlaceholder(this.t('introduction.settings.customizecolumns.parameters.column_names_placeholder'))
                                .setValue(
                                    introduction!.yaml_data ||
                                        '- name: key1\n  value: value1\n- name: key2\n  value: value2',
                                )
                                .setStyle(TextInputStyle.Paragraph),
                        ),
                    ),
            );
        }
    }

    @SettingGenericSettingComponent({
        database: Introduction,
        database_key: 'daily_submit_limit',
        format_specifier: '`%s`',
    })
    public async setDailySubmissionLimit(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        if (interaction.isModalSubmit()) {
            const limit_value = interaction.fields.getTextInputValue('daily_limit');
            const limit = parseInt(limit_value, 10);
            if (isNaN(limit) || limit < 1 || limit > 100) {
                this.warning = this.t('introduction.settings.setdailysubmissionlimit.limit_range');
                this.log.send('warn', 'command.introduction.setting.validation.failed', {
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
            this.log.send('debug', 'command.setting.modalsubmit.success', {
                name: this.name,
                guild: interaction.guild,
            });
        } else if (interaction.isStringSelectMenu()) {
            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId('settings:introduction:setdailysubmissionlimit')
                    .setTitle(this.t('introduction.settings.setdailysubmissionlimit.pretty_name'))
                    .addComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                            new TextInputBuilder()
                                .setCustomId('daily_limit')
                                .setLabel(this.t('introduction.settings.setdailysubmissionlimit.parameters.label'))
                                .setMaxLength(3)
                                .setStyle(TextInputStyle.Short)
                                .setValue(introduction!.daily_submit_limit.toString()),
                        ),
                    ),
            );
        }
    }

    @SettingChannelMenuComponent({
        database: Introduction,
        database_key: 'channel_id',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
        },
    })
    public async changeTargetChannel(
        interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.setting.channel.start', { name: this.name, guild: interaction.guild });
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
        this.log.send('debug', 'command.setting.channel.success', {
            name: this.name,
            guild: interaction.guild,
            channel: selected_channel,
        });
    }
    // ================================================================ //
}
