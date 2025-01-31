import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChannelSelectMenuBuilder,
    ChannelType,
    Colors,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { LogNotifier } from '../../types/database/syslog_notifier';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const settings = async (interaction: StringSelectMenuInteraction) => {
    const log_notifier = await DatabaseConnection.manager
        .findOne(LogNotifier, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    if (!log_notifier) {
        const new_log_notifier = new LogNotifier();
        new_log_notifier.from_guild = await DatabaseConnection.manager
            .findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        new_log_notifier.latest_action_from_user = await DatabaseConnection.manager
            .findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        await DatabaseConnection.manager.save(new_log_notifier).catch((err) => {
            Logger('error', err, interaction);
        });
        return settings(interaction);
    }

    let status = log_notifier.is_enabled ? 'Disable' : 'Enable';
    const channel_select_menu = new ChannelSelectMenuBuilder()
        .setCustomId('settings:log_notifier:21')
        .setPlaceholder('Select a channel')
        .setChannelTypes(ChannelType.GuildText);

    const genPostEmbed = (warn?: string): EmbedBuilder => {
        const post = new EmbedBuilder().setTitle(':gear: Log Notifier Settings');
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
                value: log_notifier.is_enabled ? ':green_circle: True' : ':red_circle: False',
            },
            {
                name: 'Channel',
                value: log_notifier.channel_id ? `<#${log_notifier.channel_id}>` : 'Not set',
            }
        );

        post.addFields(fields);
        return post;
    };

    const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
        const menu = new StringSelectMenuBuilder().setCustomId('settings:log_notifier:0').addOptions([
            {
                label: `${status} Log Notifier System`,
                description: `${status} the error notifier system`,
                value: 'settings:log_notifier:1',
            },
            {
                label: 'Change Log Notifier Channel',
                description: 'Edit the channel where Log Notifier are sent',
                value: 'settings:log_notifier:2',
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
            log_notifier.is_enabled = !log_notifier.is_enabled;
            status = log_notifier.is_enabled ? 'Disable' : 'Enable';
            await DatabaseConnection.manager.save(log_notifier).catch((err) => {
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
                        .addComponents(channel_select_menu)
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '21':
            log_notifier.channel_id = interaction.values[0];
            await DatabaseConnection.manager.save(log_notifier).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        default:
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
    }
};

export default {
    enabled: true,
    name: 'log_notifier',
    type: 'customizable',
    description: 'If an anormal status has occurred, notify it to the moderators.',

    category: 'pseudo',
    cooldown: 0,

    settings: settings,
} as Command_t;
