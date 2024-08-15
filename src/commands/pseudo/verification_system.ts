import { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ModalActionRowComponentBuilder, ModalBuilder, PermissionFlagsBits, RoleSelectMenuBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Command_t } from "../../types/interface/commands";

const settings = async (interaction: any) => {
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });
    const verification_message = new TextInputBuilder().setCustomId('verification_message').setLabel('Verification Message').setStyle(TextInputStyle.Paragraph).setPlaceholder('{{user}} to mention the user\n{{minimumage}} to mention the minimum age').setRequired(true);
    const verification_days = new TextInputBuilder().setCustomId('verification_days').setLabel('Verification System Minimum Days').setStyle(TextInputStyle.Short).setPlaceholder('Minimum days a user must have their account to be verified').setRequired(true);
    let verification_system_status = guild.verification_system ? 'Disable' : 'Enable';
    const channel_select_menu = new ChannelSelectMenuBuilder().setCustomId('settings:verification:21').setPlaceholder('Select a channel').setChannelTypes(ChannelType.GuildText);

    const createMenuOptions = () => [
        { label: `${verification_system_status} Verification system`, description: `${verification_system_status} the verification system`, value: 'settings:verification:1' },
        { label: 'Change Verification System Channel', description: 'Change the channel where the verification system', value: 'settings:verification:2' },
        { label: 'Change Verification System Role', description: 'Change the role that is given to verified users', value: 'settings:verification:3' },
        { label: 'Change Verification System Message', description: 'Change the message that is sent to unverified users', value: 'settings:verification:4' },
        { label: 'Change Verification System Minimum Days', description: 'Change the minimum days a user must have their account to be verified', value: 'settings:verification:5' },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    ];

    let menu = new StringSelectMenuBuilder().setCustomId('settings:verification:0').addOptions(...createMenuOptions());
    let row = new ActionRowBuilder().addComponents(menu);

    const menu_path = interaction.values ? (interaction.values[0].includes("settings:") ? interaction.values[0].split(':').at(-1) : interaction.customId.split(':').at(-1)) : interaction.customId.split(':').at(-1);

    switch (menu_path) {
        case '1':
            if (verification_system_status === 'Enable') {
                guild.verification_system = true;
                verification_system_status = 'Disable';
            } else {
                guild.verification_system = false;
                verification_system_status = 'Enable';
            }
            await DatabaseConnection.manager.save(guild);

            menu = new StringSelectMenuBuilder().setCustomId('settings:verification:0').addOptions(...createMenuOptions());
            row = new ActionRowBuilder().addComponents(menu);
            await interaction.update({
                content: `Verification System ${guild.verification_system ? 'enabled' : 'disabled'}`,
                components: [row]
            });
            break;
        case '2':
            await interaction.update({
                content: 'Select a channel',
                components: [new ActionRowBuilder().addComponents(channel_select_menu)]
            });
            break;
        case '21':
            guild.verification_system_channel_id = interaction.values[0];
            await DatabaseConnection.manager.save(guild).then(() => 
                interaction.update({
                    content: `Verification System channel set to <#${guild.verification_system_channel_id}>`,
                    components: [row]
                })
            ).catch((err) => {
                interaction.update({
                    content: `Error: ${err}`,
                    components: [row]
                });   
            });
            break;
        case '3':
            const role_select_menu = new RoleSelectMenuBuilder().setCustomId('settings:verification:31').setPlaceholder('Select a role');
            await interaction.update({
                content: 'Select a role',
                components: [new ActionRowBuilder().addComponents(role_select_menu)]
            });
            break;
        case '31':
            guild.verification_system_role_id = interaction.values[0];
            if (interaction.guild.roles.cache.get(guild.verification_system_role_id).permissions.has(PermissionFlagsBits.Administrator)) {
                interaction.update({
                    content: 'Cannot set an administrator role as the verification system role',
                    components: [row]
                });
                return;
            }

            await DatabaseConnection.manager.save(guild).then(() => 
                interaction.update({
                    content: `Verification System role set to <@&${guild.verification_system_role_id}>`,
                    components: [row]
                })
            ).catch((err) => {
                interaction.update({
                    content: `Error: ${err}`,
                    components: [row]
                });   
            });
            break;
        case '4':
            await interaction.showModal(new ModalBuilder().setCustomId(`settings:verification:41`).setTitle('Verification System Message').addComponents(
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(verification_message.setValue(guild.verification_system_message ?? ''))
            ));
            break;
        case '41':
            guild.verification_system_message = interaction.fields.getTextInputValue('verification_message');
            await DatabaseConnection.manager.save(guild).then(() => 
                interaction.update({
                    content: `Verification System message has been updated`,
                    components: [row]
                })
            ).catch((err) => {
                interaction.update({
                    content: `Error: ${err}`,
                    components: [row]
                });   
            })
            break;
        case '5':
            await interaction.showModal(new ModalBuilder().setCustomId(`settings:verification:51`).setTitle('Verification System Minimum Days').addComponents(
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(verification_days.setValue(guild.verification_system_minimum_days.toString()))
            ));
            break;
        case '51':
            let days = parseInt(interaction.fields.getTextInputValue('verification_days'));
            if (isNaN(days)) {
                interaction.update({
                    content: 'Invalid number',
                    components: [row]
                });
                return;
            }
            guild.verification_system_minimum_days = days;
            await DatabaseConnection.manager.save(guild).then(() => 
                interaction.update({
                    content: `Verification System minimum days set to ${days}`,
                    components: [row]
                })
            ).catch((err) => {
                interaction.update({
                    content: `Error: ${err}`,
                    components: [row]
                });   
            })
            break;
        default:
            await interaction.update({
                content: 'Select a setting',
                components: [row]
            });
            break;
        }
}

export default {
    enabled: true,
    name: 'verification',
    type: 'customizable',
    description: 'Verification system settings wrapper.',

    category: 'pseudo',
    cooldown: 0,
    usage: '/settings',

    settings: settings,
} as Command_t;