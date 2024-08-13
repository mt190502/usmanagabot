import { ActionRowBuilder, APIActionRowComponent, APIMessageActionRowComponent, ModalActionRowComponentBuilder, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { BotCommands, DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Command_t } from "../../types/interface/commands";

const settings = async (interaction: any) => {
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });
    let message_logger_status = guild.message_logger ? 'Disable' : 'Enable';
    const channel_id = new TextInputBuilder().setCustomId('channel_id').setLabel('Channel ID').setStyle(TextInputStyle.Short);

    const createMenuOptions = () => [
        { label: `${message_logger_status} Message Logger`, description: `${message_logger_status} the message logger`, value: 'settings:settings:1' },
        { label: 'Change Message Logger Channel', description: 'Change the channel where message logs are sent', value: 'settings:settings:2' },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    ];

    let menu = new StringSelectMenuBuilder().setCustomId('settings:settings:1').addOptions(...createMenuOptions());
    let row = new ActionRowBuilder().addComponents(menu);

    const menu_path = interaction.values ? interaction.values[0].split(':').at(-1) : interaction.customId.split(':').at(-1);
    switch (menu_path) {
        case '1':
            if (message_logger_status === 'Enable') {
                guild.message_logger = true;
                message_logger_status = 'Disable';
            } else {
                guild.message_logger = false;
                message_logger_status = 'Enable';
            }
            await DatabaseConnection.manager.save(guild);

            menu = new StringSelectMenuBuilder().setCustomId('settings:settings:0').addOptions(...createMenuOptions());
            row = new ActionRowBuilder().addComponents(menu);
            await interaction.update({
                content: `Message logger ${guild.message_logger ? 'enabled' : 'disabled'}`,
                components: [row]
            });
            break;
        case '2':
            await interaction.showModal(new ModalBuilder().setCustomId(`settings:settings:21`).setTitle('Message Logger Channel ID').addComponents(
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(channel_id.setValue(guild.message_logger_channel_id ?? '')),
            ));
            break;
        case '21':
            guild.message_logger_channel_id = interaction.fields.getTextInputValue('channel_id');
            await DatabaseConnection.manager.save(guild).then(() => {
                interaction.update({ content: `Message logger channel set to <#${guild.message_logger_channel_id}>`, components: [row] });
            }).catch((error) => {
                interaction.update({ content: 'Error setting message logger channel', components: [row] });
            });
            break;
        default:
            await interaction.update({
                content: 'Select a setting',
                components: [row]
            });
            break;
    }
}

const exec = async (interaction: any) => {
    const guildID = BigInt(interaction.guild.id);
    
    await interaction[interaction.isChatInputCommand() ? 'reply' : 'update']({
        ephemeral: true,
        content: 'Select a setting',
        components: [(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('settings').addOptions(
                BotCommands.get(guildID).filter((command) => command.settings).map((command) => ({
                label: command.name[0].toUpperCase() + command.name.slice(1),
                description: command.description,
                value: `settings:${command.name}`,
            })).concat({
                label: 'Settings',
                description: 'Change internal bot settings',
                value: 'settings:settings',
            }),
        ),
        )).toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
    });
};

const scb = async (): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    return new SlashCommandBuilder().setName('settings').setDescription('Change bot settings').setDefaultMemberPermissions(
        PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers,
    );
};

export default {
    enabled: true,
    name: 'settings',
    type: 'standard',
    description: 'Change bot settings',

    category: 'utils',
    cooldown: 5,
    usage: '/settings',

    data: scb,
    execute: exec,
    settings: settings,
} as Command_t;
