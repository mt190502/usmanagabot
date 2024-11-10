import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    Colors,
    EmbedBuilder,
    GuildMember,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { BotClient, DatabaseConnection } from '../../main';
import { Autorole } from '../../types/database/autorole';
import { Guilds } from '../../types/database/guilds';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const settings = async (interaction: StringSelectMenuInteraction) => {
    const autorole_system = await DatabaseConnection.manager
        .findOne(Autorole, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    if (!autorole_system) {
        const new_autorole = new Autorole();
        new_autorole.from_guild = await DatabaseConnection.manager
            .findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        new_autorole.latest_action_from_user = await DatabaseConnection.manager
            .findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        await DatabaseConnection.manager.save(new_autorole).catch((err) => {
            Logger('error', err, interaction);
        });
        return settings(interaction);
    }

    let status = autorole_system.is_enabled ? 'Disable' : 'Enable';
    const role_select_menu = new RoleSelectMenuBuilder()
        .setCustomId('settings:autorole:21')
        .setPlaceholder('Select a role');

    const genPostEmbed = (warn?: string): EmbedBuilder => {
        const post = new EmbedBuilder().setTitle(':gear: Autorole Settings');
        const fields: { name: string; value: string }[] = [];

        if (warn) {
            post.setColor(Colors.Yellow);
            fields.push({ name: ':warning: Warning', value: warn });
        } else {
            post.setColor(Colors.Blurple);
        }

        fields.push(
            {
                name: 'Enabled',
                value: autorole_system.is_enabled ? ':green_circle: True' : ':red_circle: False',
            },
            {
                name: 'Role',
                value: autorole_system.role_id ? `<@&${autorole_system.role_id}>` : 'Not set',
            }
        );

        post.addFields(fields);
        return post;
    };

    const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
        const menu = new StringSelectMenuBuilder().setCustomId('settings:autorole:0').addOptions([
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
        ]);

        return new ActionRowBuilder()
            .addComponents(menu)
            .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>;
    };

    const menu_path = interaction.values
        ? interaction.values[0].includes('settings:')
            ? interaction.values[0].split(':').at(-1)
            : interaction.customId.split(':').at(-1)
        : interaction.customId.split(':').at(-1);

    switch (menu_path) {
        case '1':
            autorole_system.is_enabled = !autorole_system.is_enabled;
            status = autorole_system.is_enabled ? 'Disable' : 'Enable';
            await DatabaseConnection.manager.save(autorole_system).catch((err) => {
                Logger('error', err, interaction);
            });

            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;

        case '2':
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [
                    new ActionRowBuilder()
                        .addComponents(role_select_menu)
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;

        case '21': {
            const server_roles = interaction.guild.roles.cache.sort((a, b) => b.position - a.position);
            const bot_role = server_roles.find((role) => role.name === BotClient.user.username);
            const requested_role = server_roles.get(interaction.values[0]);

            if (requested_role.position >= bot_role.position) {
                await interaction.update({
                    embeds: [genPostEmbed('The role is behind the bot role. Please select another role.')],
                    components: [genMenuOptions()],
                });
                return;
            }

            autorole_system.role_id = interaction.values[0];
            await DatabaseConnection.manager.save(autorole_system).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        }
        default:
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
    }
};

const exec = async (event_name: string, member: GuildMember) => {
    if (event_name === 'guildMemberAdd') {
        const autorole_system = await DatabaseConnection.manager
            .findOne(Autorole, {
                where: { from_guild: { gid: BigInt(member.guild.id) } },
            })
            .catch((err) => {
                Logger('error', err, member);
            });

        if (!autorole_system || !autorole_system.is_enabled) return;

        const role = member.guild.roles.cache.get(autorole_system.role_id);
        if (!role) return;

        member.roles.add(role);
    }
};

export default {
    enabled: true,
    name: 'autorole',
    type: 'customizable',
    description: 'Autorole system settings wrapper.',

    category: 'pseudo',
    cooldown: 0,

    usewithevent: ['guildMemberAdd'],
    execute_when_event: exec,
    settings: settings,
} as Command_t;
