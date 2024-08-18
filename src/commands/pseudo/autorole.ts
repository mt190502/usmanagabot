import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    GuildMember,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Autorole } from '../../types/database/autorole';
import { Guilds } from '../../types/database/guilds';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';

const settings = async (interaction: StringSelectMenuInteraction) => {
    const autorole_system = await DatabaseConnection.manager.findOne(Autorole, {
        where: { from_guild: { gid: BigInt(interaction.guild.id) } },
    });
    if (!autorole_system) {
        const new_autorole = new Autorole();
        new_autorole.from_guild = await DatabaseConnection.manager.findOne(Guilds, {
            where: { gid: BigInt(interaction.guild.id) },
        });
        new_autorole.latest_action_from_user = await DatabaseConnection.manager.findOne(Users, {
            where: { uid: BigInt(interaction.user.id) },
        });
        await DatabaseConnection.manager.save(new_autorole);
        return settings(interaction);
    }
    let status = autorole_system.is_enabled ? 'Disable' : 'Enable';
    const role_select_menu = new RoleSelectMenuBuilder()
        .setCustomId('settings:autorole:21')
        .setPlaceholder('Select a role');

    const createMenuOptions = () => [
        {
            label: `${status} Autorole System`,
            description: `${status} the autorole system`,
            value: 'settings:autorole:1',
        },
        {
            label: 'Change Autorole Role',
            description: 'Edit the role that is given to new users',
            value: 'settings:autorole:2',
        },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    ];

    let menu = new StringSelectMenuBuilder().setCustomId('settings:autorole:0').addOptions(...createMenuOptions());
    let row = new ActionRowBuilder().addComponents(menu);

    const menu_path = interaction.values
        ? interaction.values[0].includes('settings:')
            ? interaction.values[0].split(':').at(-1)
            : interaction.customId.split(':').at(-1)
        : interaction.customId.split(':').at(-1);

    switch (menu_path) {
        case '1':
            if (status === 'Enable') {
                autorole_system.is_enabled = true;
                status = 'Disable';
            } else {
                autorole_system.is_enabled = false;
                status = 'Enable';
            }
            await DatabaseConnection.manager.save(autorole_system);

            status = autorole_system.is_enabled ? 'Disable' : 'Enable';
            menu = new StringSelectMenuBuilder().setCustomId('settings:autorole:0').addOptions(...createMenuOptions());
            row = new ActionRowBuilder().addComponents(menu);
            await interaction.update({
                content: `Autorole system ${autorole_system.is_enabled ? 'enabled' : 'disabled'}`,
                components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
            });
            break;
        case '2':
            await interaction.update({
                content: 'Select a role',
                components: [
                    new ActionRowBuilder()
                        .addComponents(role_select_menu)
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '21':
            autorole_system.role_id = interaction.values[0];
            await DatabaseConnection.manager.save(autorole_system);
            await interaction.update({
                content: `Autorole role set to <@&${interaction.values[0]}>`,
                components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
            });
            break;
        default:
            await interaction.update({
                content: 'Select a setting',
                components: [row.toJSON() as APIActionRowComponent<APIMessageActionRowComponent>],
            });
            break;
    }
};

const exec = async (event_name: string, member: GuildMember) => {
    switch (event_name) {
        case 'guildMemberAdd': {
            const autorole_system = await DatabaseConnection.manager.findOne(Autorole, {
                where: { from_guild: { gid: BigInt(member.guild.id) } },
            });
            if (!autorole_system || !autorole_system.is_enabled) return;
            const role = member.guild.roles.cache.get(autorole_system.role_id);
            if (!role) return;
            member.roles.add(role);
            break;
        }
        default:
            break;
    }
};

export default {
    enabled: true,
    name: 'autorole',
    type: 'customizable',
    description: 'Autorole system settings wrapper.',

    category: 'pseudo',
    cooldown: 0,
    usage: '/settings',
    usewithevent: ['guildMemberAdd'],

    execute_when_event: exec,
    settings: settings,
} as Command_t;
