import {
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    StringSelectMenuInteraction,
    TextChannel,
} from 'discord.js';
import { CommandLoader } from '..';
import { Messages } from '../../types/database/entities/messages';
import { Reports } from '../../types/database/entities/reports';
import { SettingChannelMenuComponent, SettingToggleButtonComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class ReportCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'report',
            pretty_name: 'Report',
            description: 'Report a user to the moderators',
            cooldown: 10,
            help: `
                Use this command to report a user to the moderators. If you provide a message URL, it will help the moderators understand the context of your report.

                **Usage:**
                - \`/report [user] [reason] <message_urls?>\`

                **Options:**
                - \`user\` (required): The user you want to report.
                - \`reason\` (required): The reason for reporting the user.
                - \`message_urls\` (optional): One or more message URLs that provide context for the report.

                **Example:**
                - \`/report user:1234567890 reason:Inappropriate behavior message_url:https://discord.com/channels/123456789012345678/987654321098765432/123456789012345678\`
            `,
        });
        (this.base_cmd_data as SlashCommandBuilder)
            .addUserOption((option) => option.setName('user').setDescription('User to report').setRequired(true))
            .addStringOption((option) => option.setName('reason').setDescription('Reason for report').setRequired(true))
            .addStringOption((option) =>
                option.setName('message_url').setDescription('Message URL/URLs').setRequired(false),
            );
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let report = await this.db.findOne(Reports, { where: { from_guild: guild! } });
        if (!report) {
            const new_settings = new Reports();
            new_settings.is_enabled = false;
            new_settings.latest_action_from_user = system_user!;
            new_settings.from_guild = guild!;
            report = await this.db.save(new_settings);
        }
        this.enabled = report.is_enabled;
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
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
                .setTitle(':warning: Warning')
                .setDescription('Report command is not configured properly. Please contact an administrator.')
                .setColor(Colors.Red);
            await interaction.reply({ embeds: [user_post], flags: MessageFlags.Ephemeral });
            return;
        }

        let message_urls;
        if (message_url) {
            message_urls = message_url.split(' ');
            for (const url of message_urls) {
                if (!pattern.test(url)) {
                    user_post
                        .setTitle(':warning: Warning')
                        .setDescription(`Invalid message URL: ${url}`)
                        .setColor(Colors.Red);
                    await interaction.reply({ content: `Invalid message URL: ${url}`, flags: MessageFlags.Ephemeral });
                    return;
                }
            }
        } else {
            if (!message_in_database) {
                user_post
                    .setTitle(':warning: Warning')
                    .setDescription('Message not found in database. Please provide a message URL.')
                    .setColor(Colors.Red);
                await interaction.reply({
                    embeds: [user_post],
                    flags: MessageFlags.Ephemeral,
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
                `:mag: **Reported**: ${user.username} (ID ${user.id})\n:page_facing_up: **Reason**: ${reason}\n:envelope: **Messages**: ${message_urls.join(' ')}\n:triangular_flag_on_post: **Channel**: <#${interaction.channel!.id}>`,
            );
        (message_channel_id as TextChannel).send({ embeds: [admin_post] });

        user_post
            .setTitle(':white_check_mark: Success')
            .setColor(Colors.Green)
            .setDescription(`**User**: ${user} reported successfully.\n**Reason**: ${reason}`);
        await interaction.reply({ embeds: [user_post], flags: MessageFlags.Ephemeral });
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @SettingToggleButtonComponent({
        display_name: 'Enabled',
        database: Reports,
        database_key: 'is_enabled',
        pretty: 'Toggle Report Command',
        description: 'Toggle the report command enabled/disabled.',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        const report = await this.db.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        report!.is_enabled = !report!.is_enabled;
        this.enabled = report!.is_enabled;
        await this.db.save(Reports, report!);
        CommandLoader.getInstance().RESTCommandLoader(this, interaction.guildId!);
        await this.settingsUI(interaction);
    }

    @SettingChannelMenuComponent({
        display_name: 'Target Channel',
        database: Reports,
        database_key: 'channel_id',
        pretty: 'Set Report Target Channel',
        description: 'Set the target channel where reports will be posted.',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
            placeholder: 'Select the target channel for reports',
        },
    })
    public async changeTargetChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
        const report = await this.db.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const selected_channel = interaction.values[0];
        report!.channel_id = selected_channel;
        await this.db.save(Reports, report!);
        await this.settingsUI(interaction);
    }
    // ================================================================ //
}
