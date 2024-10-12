import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChannelSelectMenuBuilder,
    ChannelType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Messages } from '../../types/database/messages';
import { Reports } from '../../types/database/reports';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';
import { RESTCommandLoader } from '../loader';

const settings = async (interaction: StringSelectMenuInteraction) => {
    try {
        const report_system = await DatabaseConnection.manager.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        });

        if (!report_system) {
            const new_report = new Reports();
            new_report.from_guild = await DatabaseConnection.manager.findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            });
            new_report.latest_action_from_user = await DatabaseConnection.manager.findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            });
            await DatabaseConnection.manager.save(new_report);
            return settings(interaction);
        }

        const channel_select_menu = new ChannelSelectMenuBuilder()
            .setCustomId('settings:report:21')
            .setPlaceholder('Select a channel')
            .setChannelTypes(ChannelType.GuildText);

        let status = report_system.is_enabled ? 'Disable' : 'Enable';
        const menu_path = interaction.values
            ? interaction.values[0].includes('settings:')
                ? interaction.values[0].split(':').at(-1)
                : interaction.customId.split(':').at(-1)
            : interaction.customId.split(':').at(-1);

        const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
            const menu = new StringSelectMenuBuilder().setCustomId('settings:report:0').addOptions([
                {
                    label: `${status} Report System`,
                    description: `${status} the report system`,
                    value: 'settings:report:1',
                },
                {
                    label: 'Change Report Channel',
                    description: 'Edit the channel where reports are sent',
                    value: 'settings:report:2',
                },
                { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
            ]);
            return new ActionRowBuilder()
                .addComponents(menu)
                .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>;
        };

        switch (menu_path) {
            case '1':
                report_system.is_enabled = !report_system.is_enabled;
                status = report_system.is_enabled ? 'Disable' : 'Enable';
                await DatabaseConnection.manager.save(report_system);

                await interaction.update({
                    content: `Report system ${report_system.is_enabled ? 'enabled' : 'disabled'}`,
                    components: [genMenuOptions()],
                });
                await RESTCommandLoader(report_system.from_guild.gid);
                break;
            case '2':
                await interaction.update({
                    content: 'Select a channel',
                    components: [
                        new ActionRowBuilder()
                            .addComponents(channel_select_menu)
                            .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                    ],
                });
                break;
            case '21':
                report_system.channel_id = interaction.values[0];
                await DatabaseConnection.manager.save(report_system);
                await interaction.update({
                    content: `Report channel set to <#${report_system.channel_id}>`,
                    components: [genMenuOptions()],
                });
                break;
            default:
                await interaction.update({
                    content: 'Report Settings',
                    components: [genMenuOptions()],
                });
                break;
        }
    } catch (error) {
        Logger('warn', error.message, interaction);
    }
};

const exec = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    try {
        const report_system = await DatabaseConnection.manager.findOne(Reports, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        });

        if (!report_system || !report_system.channel_id || !report_system.is_enabled) {
            await interaction.reply({
                content:
                    'Report system is not set up properly or is disabled. Please contact the server administrator.',
                ephemeral: true,
            });
            return;
        }

        const user = interaction.options.getUser('user');
        const reporter = interaction.user;
        const reason = interaction.options.getString('reason');
        const pattern = /(https:\/\/discord.com\/channels\/\d+\/\d+\/\d+)/;
        const message_channel_id = interaction.guild.channels.cache.get(report_system.channel_id);
        const embed = new EmbedBuilder()
            .setColor(0xee82ee)
            .setAuthor({ name: `${reporter.username} (${reporter.id})`, iconURL: reporter.displayAvatarURL() })
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();

        let message_url;

        if (interaction.options.getString('message_url')) {
            message_url = interaction.options.getString('message_url').split(' ');
            for (const url of message_url) {
                if (!pattern.test(url)) {
                    await interaction.reply({ content: `Invalid message URL: ${url}`, ephemeral: true });
                    return;
                }
            }
        } else {
            const message = await DatabaseConnection.manager.findOne(Messages, {
                where: {
                    from_user: { uid: BigInt(user.id) },
                    message_is_deleted: false,
                },
                order: { id: 'DESC' },
            });

            if (!message) {
                await interaction.reply({
                    content: 'Message not found in database. Please provide a message URL.',
                    ephemeral: true,
                });
                return;
            }

            message_url = [
                `https://discord.com/channels/${message.from_guild.gid}/${message.from_channel.cid}/${message.message_id}`,
            ];
        }

        if (!message_channel_id) {
            await interaction.reply({
                content: `Target channel (${report_system.channel_id}) not found`,
                ephemeral: true,
            });
            return;
        }

        embed.setDescription(
            `:mag: **Reported**: ${user.username} (ID ${user.id})\n:page_facing_up: **Reason**: ${reason}\n:envelope: **Messages**: ${message_url.join(' ')}\n:triangular_flag_on_post: **Channel**: <#${interaction.channel.id}>`
        );
        (message_channel_id as TextChannel).send({ embeds: [embed] });

        await interaction.reply({ content: `User ${user} reported\nReason: ${reason}`, ephemeral: true });
    } catch (error) {
        Logger('warn', error.message, interaction);
    }
};

const scb = (): Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> => {
    const data = new SlashCommandBuilder().setName('report').setDescription('Report a user to the moderators.');
    data.addUserOption((option) => option.setName('user').setDescription('User to report').setRequired(true));
    data.addStringOption((option) => option.setName('reason').setDescription('Reason for report').setRequired(true));
    data.addStringOption((option) =>
        option.setName('message_url').setDescription('Message URL/URLs').setRequired(false)
    );
    return data;
};

export default {
    enabled: true,
    name: 'report',
    type: 'customizable',

    description: 'Report a user to the moderators.',
    category: 'misc',
    cooldown: 5,
    usage: '/report <@user> <reason>',

    data: [scb],
    execute: exec,
    settings: settings,
} as Command_t;
