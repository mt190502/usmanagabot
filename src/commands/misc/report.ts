import { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, SlashCommandBuilder, StringSelectMenuBuilder } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Messages } from "../../types/database/messages";
import { Reports } from "../../types/database/reports";
import { Users } from "../../types/database/users";
import { Command_t } from "../../types/interface/commands";
import { RESTCommandLoader } from "../loader";

const settings = async (interaction: any) => {
    const report_system = await DatabaseConnection.manager.findOne(Reports, { where: { from_guild: { gid: interaction.guild.id } }});
    if (!report_system) {
        const new_report = new Reports();
        new_report.from_guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });
        new_report.latest_action_from_user = await DatabaseConnection.manager.findOne(Users, { where: { uid: interaction.user.id } });
        await DatabaseConnection.manager.save(new_report);
        return settings(interaction);
    }
    const channel_select_menu = new ChannelSelectMenuBuilder().setCustomId('settings:report:21').setPlaceholder('Select a channel').setChannelTypes(ChannelType.GuildText);
    let status = report_system.is_enabled ? 'Disable' : 'Enable';

    const menu_path = interaction.values ? (interaction.values[0].includes("settings:") ? interaction.values[0].split(':').at(-1) : interaction.customId.split(':').at(-1)) : interaction.customId.split(':').at(-1);
    
    const createMenuOptions = () => [
        { label: `${status} Report System`, description: `${status} the report system`, value: 'settings:report:1' },
        { label: 'Change Report Channel', description: 'Edit the channel where reports are sent', value: 'settings:report:2' },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    ];

    let menu = new StringSelectMenuBuilder().setCustomId('settings:report:0').addOptions(...createMenuOptions());
    let row = new ActionRowBuilder().addComponents(menu);

    switch (menu_path) {
        case '1':
            if (status === 'Enable') {
                report_system.is_enabled = true;
                status = 'Disable';
            } else {
                report_system.is_enabled = false;
                status = 'Enable';
            }
            await DatabaseConnection.manager.save(report_system);

            status = report_system.is_enabled ? 'Disable' : 'Enable';
            menu = new StringSelectMenuBuilder().setCustomId('settings:report:0').addOptions(...createMenuOptions());
            row = new ActionRowBuilder().addComponents(menu);
            await interaction.update({ 
                content: `Report system ${report_system.is_enabled ? 'enabled' : 'disabled'}`,
                components: [row] 
            });
            await RESTCommandLoader(report_system.from_guild.gid);
            break;
        case '2':
            await interaction.update({
                content: 'Select a channel',
                components: [new ActionRowBuilder().addComponents(channel_select_menu)]
            });
            break;
        case '21':
            report_system.channel_id = interaction.values[0];
            await DatabaseConnection.manager.save(report_system).then(() => {
                interaction.update({ content: `Report channel set to <#${report_system.channel_id}>`, components: [row] });
            }).catch((error) => {
                interaction.update({ content: 'Error setting report channel', components: [row] });
            });
            await RESTCommandLoader(report_system.from_guild.gid);
            break;
        default:
            await interaction.update({ 
                content: 'Report Settings', 
                components: [(new ActionRowBuilder().addComponents(menu))]
            });
            break;
    }
}

const exec = async (interaction: any): Promise<void> => {
    const report_system = await DatabaseConnection.manager.findOne(Reports, { where: { from_guild: { gid: interaction.guild.id } }});
    if (!report_system) return await interaction.reply({ content: 'Report system is not set up properly. Please contact the server administrator.', ephemeral: true });
    if (!report_system.channel_id) return await interaction.reply({ content: 'Report channel is not set', ephemeral: true });
    if (!report_system.is_enabled) return await interaction.reply({ content: 'Report system is disabled', ephemeral: true });
    const user = interaction.options.getUser('user');
    const reporter = interaction.user;
    const reason = interaction.options.getString('reason');
    const pattern = /(https:\/\/discord.com\/channels\/\d+\/\d+\/\d+)/;
    const message_channel_id = interaction.guild.channels.cache.get(report_system.channel_id);
    const embed = new EmbedBuilder().setColor(0xEE82EE).setAuthor({ name: `${reporter.username} (${reporter.id})`, iconURL: reporter.displayAvatarURL() }).setThumbnail(user.displayAvatarURL());
    let message_url;
    
    if (interaction.options.getString('message_url')) {
        message_url = interaction.options.getString('message_url').replace(/\s+/g, ' ').split(' ');
        for (let i = 0; i < message_url.length; i++) {
            if (!pattern.test(message_url[i])) {
                await interaction.reply({ content: `Invalid message URL: ${message_url[i]}`, ephemeral: true });
                return;
            }
        }
    } else {
        let message;
        try {
            message = await DatabaseConnection.manager.findOne(Messages, { where: { from_user: { uid: BigInt(user.id) }, message_is_deleted: false, from_channel: { cid: BigInt(interaction.channel.id)} }, order: { id: 'DESC' } });
        } catch (error) {
            await interaction.reply({ content: 'Error fetching message from database', ephemeral: true });
            return;
        }

        if (!message) {
            await interaction.reply({ content: 'Message not found in database. Please provide a message URL.', ephemeral: true });
            return;
        }
        const url = `https://discord.com/channels/${message.from_guild.gid}/${message.from_channel.cid}/${message.message_id}`;
        message_url = [url];
    }

    if (!message_channel_id) return await interaction.reply({ content: `Target channel (${report_system.channel_id}) not found`, ephemeral: true });
    
    embed.setDescription(`:mag: **Reported**: ${user.username} (ID ${user.id})\n:page_facing_up: **Reason**: ${reason}\n:envelope: **Messages**: ${message_url.join(' ')}\n:triangular_flag_on_post: **Channel**: <#${interaction.channel.id}>`);
    await message_channel_id.send({ embeds: [embed] });
    await interaction.reply({ content: `User ${user} reported\nReason: ${reason}`, ephemeral: true });
}

const scb = (): Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> => {
    const data = new SlashCommandBuilder().setName('report').setDescription('Report a user to the moderators.')
    data.addUserOption((option) => option.setName('user').setDescription('User to report').setRequired(true))
    data.addStringOption((option) => option.setName('reason').setDescription('Reason for report').setRequired(true))
    data.addStringOption((option) => option.setName('message_url').setDescription('Message URL/URLs').setRequired(false));
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

    data: scb,
    execute: exec,
    settings: settings,
} as Command_t;