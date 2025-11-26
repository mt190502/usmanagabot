import {
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    MessageFlags,
    RoleSelectMenuInteraction,
    SlashCommandBuilder,
    StringSelectMenuInteraction,
    TextChannel,
} from 'discord.js';
import { CommandLoader } from '..';
import { Messages } from '../../types/database/entities/messages';
import { Reports } from '../../types/database/entities/reports';
import {
    SettingChannelMenuComponent,
    SettingGenericSettingComponent,
    SettingRoleSelectMenuComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';
import { Log } from '../../types/decorator/log';

/**
 * A command for users to report other users to the server administration.
 *
 * This command allows any user to file a report against another user, providing a reason and
 * optional links to specific messages as evidence. The report is then sent to a pre-configured
 * private channel where administrators can review it.
 *
 * The command is highly configurable per-guild, allowing settings for:
 * - A target channel for reports.
 * - A specific role to be pinged for new reports.
 * - Enabling or disabling the report system entirely.
 */
export default class ReportCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'report', cooldown: 10 });

        (this.base_cmd_data as SlashCommandBuilder)
            .addUserOption((option) =>
                option.setName('user').setDescription(this.t('parameters.user')).setRequired(true),
            )
            .addStringOption((option) =>
                option.setName('reason').setDescription(this.t('parameters.reason')).setRequired(true),
            )
            .addStringOption((option) =>
                option.setName('message_url').setDescription(this.t('parameters.message_url_list')).setRequired(false),
            );
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let report = await this.db.findOne(Reports, { where: { from_guild: guild! } });
        if (!report) {
            const new_settings = new Reports();
            new_settings.is_enabled = false;
            new_settings.latest_action_from_user = system_user!;
            new_settings.from_guild = guild!;
            report = await this.db.save(new_settings);
            this.log.send('log', 'command.prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = report.is_enabled;
        this.log.send('debug', 'command.prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * Executes the report submission process.
     *
     * This method validates user input, checks if the report system is configured,
     * gathers details about the reporter and the reported user, and formats an
     * embed. It then sends this embed to the designated report channel, pinging
     * the moderator role if configured. Finally, it sends an ephemeral confirmation
     * message back to the user who filed the report.
     *
     * @param interaction The `ChatInputCommandInteraction` from the user.
     */
    @Log()
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const user_post = new EmbedBuilder();
        const admin_post = new EmbedBuilder();
        const report = await this.db.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = interaction.options.getUser('user')!;
        const reporter = interaction.user;
        const reason = interaction.options.getString('reason');
        const pattern = /^(https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+)$/;
        const message_url = interaction.options.getString('message_url');
        const message_channel_id = interaction.guild!.channels.cache.get(report!.channel_id);
        const message_in_database = await this.db.findOne(Messages, {
            where: {
                from_user: { uid: BigInt(user.id) },
                message_is_deleted: false,
            },
            order: { id: 'DESC' },
        });

        if (!report?.channel_id) {
            user_post
                .setTitle(`:warning: ${this.t('command.execute.warning', undefined, interaction)}`)
                .setDescription(this.t('execute.command_not_configured', undefined, interaction))
                .setColor(Colors.Red);
            await interaction.reply({ embeds: [user_post], flags: MessageFlags.Ephemeral });
            this.log.send('warn', 'command.configuration.missing', { name: this.name, guild: interaction.guild });
            return;
        }

        let message_urls;
        if (message_url) {
            message_urls = message_url.split(' ');
            for (const url of message_urls) {
                if (!pattern.test(url)) {
                    user_post
                        .setTitle(`:warning: ${this.t('command.execute.warning', undefined, interaction)}`)
                        .setDescription(this.t('execute.invalid_url', { url }, interaction))
                        .setColor(Colors.Red);
                    await interaction.reply({ embeds: [user_post], flags: MessageFlags.Ephemeral });
                    this.log.send('warn', 'command.report.execute.invalid_url', {
                        guild: interaction.guild,
                        user: interaction.user,
                        url,
                    });
                    return;
                }
            }
        } else {
            if (!message_in_database) {
                user_post
                    .setTitle(`:warning: ${this.t('command.execute.warning', undefined, interaction)}`)
                    .setDescription(this.t('execute.message_not_found', undefined, interaction))
                    .setColor(Colors.Red);
                await interaction.reply({
                    embeds: [user_post],
                    flags: MessageFlags.Ephemeral,
                });
                this.log.send('warn', 'command.report.execute.message_not_found', {
                    guild: interaction.guild,
                    user: interaction.user,
                });
                return;
            }

            message_urls = [
                `https://discord.com/channels/${message_in_database.from_guild.gid}/${message_in_database.from_channel.cid}/${message_in_database.message_id}`,
            ];
        }
        admin_post
            .setColor(0xee82ee)
            .setAuthor({ name: `${reporter.username} (${reporter.id})`, iconURL: reporter.displayAvatarURL() })
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp()
            .setDescription(
                this.t(
                    'execute.admin_report_description',
                    {
                        username: user.username,
                        user_id: user.id,
                        reason,
                        message_urls: message_urls.join(' '),
                        channel_id: interaction.channel!.id,
                    },
                    interaction,
                ),
            );
        (message_channel_id as TextChannel).send({
            content: report.moderator_role_id ? `<@&${report.moderator_role_id}>` : undefined,
            embeds: [admin_post],
        });

        user_post
            .setTitle(`:white_check_mark: ${this.t('command.execute.success', undefined, interaction)}`)
            .setColor(Colors.Green)
            .setDescription(
                this.t(
                    'execute.user_reported_description',
                    {
                        user: user.username,
                        reason: reason,
                    },
                    interaction,
                ),
            );
        await interaction.reply({ embeds: [user_post], flags: MessageFlags.Ephemeral });
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    /**
     * Toggles the report system on or off for the guild.
     *
     * @param interaction The interaction from the settings UI.
     */
    @SettingGenericSettingComponent({
        database: Reports,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    @Log()
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
        const report = await this.db.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        report!.is_enabled = !report!.is_enabled;
        report!.latest_action_from_user = user;
        report!.timestamp = new Date();
        this.enabled = report!.is_enabled;
        await this.db.save(Reports, report!);
        CommandLoader.RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    /**
     * Sets the channel where reports will be sent.
     *
     * @param interaction The interaction from the settings UI.
     */
    @SettingChannelMenuComponent({
        database: Reports,
        database_key: 'channel_id',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
        },
    })
    @Log()
    public async changeTargetChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.channel.start', { name: this.name, guild: interaction.guild });
        const report = await this.db.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const selected_channel = interaction.values[0];
        report!.channel_id = selected_channel;
        report!.latest_action_from_user = user;
        report!.timestamp = new Date();
        await this.db.save(Reports, report!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.channel.success', {
            name: this.name,
            guild: interaction.guild,
            channel: selected_channel,
        });
    }

    /**
     * Sets the moderator role to be pinged when a new report is submitted.
     *
     * @param interaction The interaction from the settings UI.
     */
    @SettingRoleSelectMenuComponent({
        database: Reports,
        database_key: 'moderator_role_id',
        format_specifier: '<@&%s>',
        options: {
            min_values: 0,
            max_values: 1,
        },
    })
    @Log()
    public async changeModeratorRole(interaction: RoleSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.role.start', { name: this.name, guild: interaction.guild });
        const report = await this.db.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        report!.moderator_role_id = interaction.values[0];
        report!.latest_action_from_user = user;
        report!.timestamp = new Date();
        await this.db.save(Reports, report!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.role.success', {
            name: this.name,
            guild: interaction.guild,
            role: interaction.values[0],
        });
    }

    /**
     * Removes the configured moderator role, so no role is pinged on new reports.
     *
     * @param interaction The interaction from the settings UI.
     */
    @SettingGenericSettingComponent({ view_in_ui: false })
    @Log()
    public async removeModeratorRole(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.report.removemoderatorrole.start', { guild: interaction.guild });
        const report = await this.db.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        report!.moderator_role_id = null;
        report!.latest_action_from_user = user;
        report!.timestamp = new Date();
        await this.db.save(Reports, report!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.report.removemoderatorrole.success', { guild: interaction.guild });
    }
    // ================================================================ //
}
