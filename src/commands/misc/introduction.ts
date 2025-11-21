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
        super({
            name: 'introduction',
            pretty_name: 'Introduction',
            description: 'User introduction database command.',
            cooldown: 5,
            help: `
                Introduction command allows create customizable user introductions

                **Usage:**
                \`/introduction [options]\`

                **Examples:**
                - \`/introduction os:linux de:gnome\` - Sets introduction to "os:linux de:gnome"
                - \`/introduction car:peugeot bike:yamaha\` - Sets introduction to "car:peugeot bike:yamaha"
            `,
        });
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
                option.setName(opt_name || `option${i}`).setDescription(opt_value || `Option ${i} description`),
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
            const msg = `You have reached the maximum number of submissions for today.\nPlease try again on date: <t:${Math.floor(end_timestamp)}:F>`;
            post.setTitle(':warning: Warning').setDescription(msg).setColor(Colors.Red);
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
            post.setTitle(':warning: Warning')
                .setDescription('Introduction system is not set up properly.\nPlease contact the server administrator.')
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
        const data: string[] = [`**__About ${interaction.user.username}__**\n`];

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
            post.setTitle(':warning: Warning').setDescription('Please provide at least one value').setColor(Colors.Red);
            await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
            this.log.send('debug', 'command.introduction.execute.validation.failed', {
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }

        data.push(
            '\n**__Account Information__**\n',
            `**Username**: ${interaction.user.username}\n`,
            `**Nickname**: <@!${interaction.user.id}>\n`,
            `**ID**: ${interaction.user.id}\n`,
            `**Created At**: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>\n`,
            `**Joined At**: <t:${Math.floor(interaction.guild!.members.cache.get(interaction.user.id)!.joinedTimestamp! / 1000)}:R>\n`,
            `**Roles**: ${
                user_roles
                    .filter((r) => r.name !== '@everyone')
                    .map((r) => `<@&${r.id}>`)
                    .join(', ') || 'None'
            }\n`,
        );

        const color = user_roles.map((r) => r.hexColor).find((c) => c !== '#000000') as ColorResolvable;
        const embed = new EmbedBuilder()
            .setDescription(data.join(''))
            .setColor(color || 'Random')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();
        if (last_submit_timestamp) embed.setFooter({ text: 'Introduction Updated' });

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

        post.setTitle(':white_check_mark: Success')
            .setColor(Colors.Green)
            .setDescription(
                `Introduction submitted successfully.\nYou have **${introduction!.daily_submit_limit - last_introduction_submit_from_user.hourly_submit_count}** submissions left for today.\nIntroduction URL: ${publish.url}`,
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
        display_name: 'Enabled',
        database: Introduction,
        database_key: 'is_enabled',
        pretty: 'Toggle Introduction Command',
        description: 'Toggle the introduction command enabled/disabled.',
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

    @SettingGenericSettingComponent({
        pretty: 'Customize Introduction Command Name and Description',
        description: 'Customize the name and description of the introduction command for this server.',
    })
    public async customizeCommand(interaction: StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const cmd_name = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('cmd_name')
                .setLabel('Command Name')
                .setValue(introduction!.cmd_name)
                .setStyle(TextInputStyle.Short)
                .setRequired(false),
        );
        const cmd_desc = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('cmd_desc')
                .setLabel('Command Description')
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
                    .setTitle('Customize Introduction Command')
                    .addComponents([cmd_name, cmd_desc]),
            );
        }
    }

    @SettingGenericSettingComponent({
        pretty: 'Customize Columns',
        description: 'Customize the names and descriptions of the introduction command columns.',
    })
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
                    this.warning = `Column name \`${column.name}\` is duplicated. Please ensure all column names are unique.`;
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
                    .setTitle('Customize Introduction Columns')
                    .addComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                            new TextInputBuilder()
                                .setCustomId('column_names')
                                .setLabel('Column Names')
                                .setPlaceholder('- name: key\n  value: value\n(max 8 columns)')
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
        display_name: 'Daily Submission Limit',
        database: Introduction,
        database_key: 'daily_submit_limit',
        pretty: 'Set Daily Submission Limit',
        description: 'Set the daily submission limit for users.',
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
                this.warning = 'Please enter a valid number between 1 and 100.';
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
                    .setTitle('Set Daily Submission Limit')
                    .addComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                            new TextInputBuilder()
                                .setCustomId('daily_limit')
                                .setLabel('Daily Submission Limit (1-100)')
                                .setMaxLength(3)
                                .setStyle(TextInputStyle.Short)
                                .setValue(introduction!.daily_submit_limit.toString()),
                        ),
                    ),
            );
        }
    }

    @SettingChannelMenuComponent({
        display_name: 'Target Channel',
        database: Introduction,
        database_key: 'channel_id',
        pretty: 'Set Introduction Target Channel',
        description: 'Set the target channel where introductions will be posted.',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
            placeholder: 'Select a channel for introductions',
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
