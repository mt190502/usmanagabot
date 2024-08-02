import { ActionRowBuilder, ModalActionRowComponentBuilder, ModalBuilder, SlashCommandBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Command_t } from "../../types/interface/commands";
import { RESTCommandLoader } from "../loader";

const settings = async (interaction: any) => {
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });
    const channel_id = new TextInputBuilder().setCustomId('channel_id').setLabel('Channel ID').setStyle(TextInputStyle.Short);
    
    let status = JSON.parse(guild.disabled_commands).includes('report') ? 'Enable' : 'Disable';

    const menu_path = interaction.values ? interaction.values[0].split(':').at(-1).split('/') : interaction.customId.split(':').at(-1).split('/');
    
    const createMenuOptions = () => [
        { label: `${status} Report System`, description: `${status} the report system`, value: 'settings:report:1' },
        { label: 'Change Report Channel', description: 'Edit the channel where reports are sent', value: 'settings:report:2' },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    ];

    let menu = new StringSelectMenuBuilder().setCustomId('settings:report:0').addOptions(...createMenuOptions());
    let row = new ActionRowBuilder().addComponents(menu);

    switch (menu_path[0]) {
        case '1':
            if (status === 'Enable') {
                guild.disabled_commands = JSON.stringify(JSON.parse(guild.disabled_commands).filter((command: string) => command !== 'report'));
                status = 'Disable';
            } else {
                guild.disabled_commands = JSON.stringify([...JSON.parse(guild.disabled_commands), 'report']);
                status = 'Enable';
            }
            await DatabaseConnection.manager.save(guild);

            status = JSON.parse(guild.disabled_commands).includes('report') ? 'Enable' : 'Disable';
            menu = new StringSelectMenuBuilder().setCustomId('settings:report:0').addOptions(...createMenuOptions());
            row = new ActionRowBuilder().addComponents(menu);
            await RESTCommandLoader(Number(guild.gid))
            await interaction.update({ 
                content: `Report system ${status}d`,
                components: [row] 
            });
            break;
        case '2':
            await interaction.showModal(new ModalBuilder().setCustomId(`settings:report:21`).setTitle('Report Channel ID').addComponents(
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(channel_id.setValue(guild.report_channel_id ?? '')),
            ));
            break;
        case '21':
            guild.report_channel_id = interaction.fields.getTextInputValue('channel_id');
            await RESTCommandLoader(Number(guild.gid));
            await DatabaseConnection.manager.save(guild).then(() => {
                interaction.update({ content: `Report channel set to ${guild.report_channel_id}`, components: [row] });
            }).catch((error) => {
                interaction.update({ content: 'Error setting report channel', components: [row] });
            });
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
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const message_url = interaction.options.getString('message_url');
    const channel_id = (await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } })).report_channel_id;

    if (!channel_id) return await interaction.reply({ content: 'Report channel not set', ephemeral: true });

    const channel = interaction.guild.channels.cache.get(channel_id);
    if (!channel) return await interaction.reply({ content: 'Report channel not found', ephemeral: true });

    await channel.send({ content: `User ${user} reported for ${reason}\n${message_url}` });

    await interaction.reply({ content: `User ${user} reported for ${reason}`, ephemeral: true });
}

const scb = (): Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> => {
    const data = new SlashCommandBuilder().setName('report').setDescription('Report a user to the moderators.')
    data.addUserOption((option) => option.setName('user').setDescription('User to report').setRequired(true))
    data.addStringOption((option) => option.setName('reason').setDescription('Reason for report').setRequired(true))
    data.addStringOption((option) => option.setName('message_url').setDescription('Message URL').setRequired(true));
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