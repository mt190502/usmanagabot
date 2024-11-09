/* eslint-disable no-unused-vars */
import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChannelSelectMenuBuilder,
    ChannelType,
    Colors,
    EmbedBuilder,
    Message,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    ThreadChannel,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { ChannelRestricts, ChannelRestrictSystem } from '../../types/database/channel_restrict';
import { Guilds } from '../../types/database/guilds';
import { MessageLogger } from '../../types/database/message_logger';
import { Messages } from '../../types/database/messages';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

enum ChannelRestrictList {
    IMAGE = 1,
    LINK,
    STICKER,
    TEXT,
    THREAD,
    VIDEO,
}

const settings = async (interaction: StringSelectMenuInteraction) => {
    const restrict_system = await DatabaseConnection.manager
        .findOne(ChannelRestrictSystem, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            return undefined;
        });
    if (!restrict_system) {
        const new_restrict = new ChannelRestrictSystem();
        new_restrict.from_guild = await DatabaseConnection.manager
            .findOne(Guilds, { where: { gid: BigInt(interaction.guild.id) } })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        new_restrict.from_user = await DatabaseConnection.manager
            .findOne(Users, { where: { uid: BigInt(interaction.user.id) } })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        await DatabaseConnection.manager.save(new_restrict).catch((err) => Logger('error', err, interaction));
        return settings(interaction);
    }

    const restricts = await DatabaseConnection.manager.find(ChannelRestricts, {
        where: { from_guild: { gid: BigInt(interaction.guild.id) } },
    });
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: BigInt(interaction.guild.id) } });
    const user = await DatabaseConnection.manager.findOne(Users, { where: { uid: BigInt(interaction.user.id) } });

    const genPostEmbed = (warn?: string): EmbedBuilder => {
        const post = new EmbedBuilder().setTitle(':gear: Channel Restrict Settings');
        const fields: { name: string; value: string }[] = [];

        if (warn) {
            fields.push({ name: 'Warning', value: warn });
            post.setColor(Colors.Yellow);
        } else {
            post.setColor(Colors.Blurple);
        }

        fields.push(
            {
                name: 'Enabled',
                value: restrict_system.is_enabled ? ':green_circle: True' : ':red_circle: False',
            },
            {
                name: 'Restricted Channels',
                value: restricts.length ? restricts.map((channel) => `<#${channel.channel_id}>`).join(', ') : 'None',
            },
            {
                name: 'Mod Notifier Channel',
                value: restrict_system.mod_notifier_channel_id
                    ? `<#${restrict_system.mod_notifier_channel_id}>`
                    : 'Not set',
            }
        );
        post.addFields(fields);
        return post;
    };

    const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
        const menu = new StringSelectMenuBuilder().setCustomId('settings:channel_restrict:0').addOptions([
            {
                label: `${restrict_system.is_enabled ? 'Disable' : 'Enable'} Channel Restrict System`,
                description: `${restrict_system.is_enabled ? 'Disable' : 'Enable'} the channel restrict system`,
                value: 'settings:channel_restrict:1',
            },
            {
                label: 'Add Channel',
                description: 'Add a channel to the restrict list',
                value: 'settings:channel_restrict:2',
            },
            {
                label: 'Edit Channel Restrictions',
                description: 'Edit the restriction of a channel',
                value: 'settings:channel_restrict:3',
            },
            {
                label: 'Remove Channel',
                description: 'Remove a channel from the restrict list',
                value: 'settings:channel_restrict:4',
            },
            {
                label: 'Set Mod Notifier Channel',
                description: 'Set the channel where the bot will send notifications',
                value: 'settings:channel_restrict:5',
            },
            { label: 'Back', description: 'Return to the main settings menu', value: 'settings' },
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

    switch (menu_path.split('/')[0]) {
        case '1':
            restrict_system.is_enabled = !restrict_system.is_enabled;
            await DatabaseConnection.manager.save(restrict_system).catch((err) => Logger('error', err, interaction));
            await interaction.update({ embeds: [genPostEmbed()], components: [genMenuOptions()] });
            break;
        case '2':
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId('settings:channel_restrict:21')
                                .addChannelTypes(ChannelType.GuildText)
                        )
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
                embeds: [genPostEmbed()],
            });
            break;
        case '21':
            if (restricts.find((channel) => channel.channel_id === interaction.values[0])) {
                await interaction.update({
                    embeds: [genPostEmbed('This channel is already in the restrict list')],
                    components: [genMenuOptions()],
                });
                return;
            }

            restricts.push(
                Object.assign(new ChannelRestricts(), {
                    from_guild: guild,
                    from_user: user,
                    channel_id: interaction.values[0],
                })
            );

            await DatabaseConnection.manager.save(restricts).catch((err) => Logger('error', err, interaction));
            await interaction.update({ embeds: [genPostEmbed()], components: [genMenuOptions()] });
            break;
        case '3':
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder().setCustomId('settings:channel_restrict:31').addOptions(
                                ...restricts.map((channel) => ({
                                    label: interaction.guild.channels.cache.get(channel.channel_id)?.name,
                                    description: channel.restricts.length
                                        ? channel.restricts.map((r) => ChannelRestrictList[parseInt(r)]).join(', ')
                                        : 'None',
                                    value: `settings:channel_restrict:31/${channel.channel_id}`,
                                })),
                                {
                                    label: 'Back',
                                    description: 'Return to the previous menu',
                                    value: 'settings:channel_restrict',
                                }
                            )
                        )
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
                embeds: [genPostEmbed()],
            });
            break;
        case '31': {
            const channel_id = interaction.values[0].split('/').at(-1);
            const restrict_menu = new StringSelectMenuBuilder()
                .setCustomId('settings:channel_restrict:32')
                .setMaxValues(Object.keys(ChannelRestrictList).filter((key) => !isNaN(Number(key))).length)
                .addOptions(
                    ...Object.values(ChannelRestrictList)
                        .filter((value) => typeof value === 'number')
                        .map((restrict) => ({
                            label: ChannelRestrictList[restrict as number],
                            description: Object.keys(ChannelRestrictList)[(restrict as number) - 1],
                            value: `settings:channel_restrict:32/${channel_id}/${restrict}`,
                            default: restricts
                                .find((c) => BigInt(c.channel_id) === BigInt(channel_id))
                                ?.restricts.includes(restrict.toString()),
                        }))
                );
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(restrict_menu)
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
                embeds: [genPostEmbed()],
            });
            break;
        }
        case '32': {
            const channel_id = interaction.values[0].split('/')[1];
            const channel = restricts.find((c) => BigInt(c.channel_id) === BigInt(channel_id));
            channel.restricts = interaction.values.map((restrict) => restrict.split('/')[2]);
            await DatabaseConnection.manager.save(channel).catch((err) => {
                Logger('error', err, interaction);
            });

            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        }
        case '4':
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId('settings:channel_restrict:41')
                                .setChannelTypes(ChannelType.GuildText)
                        )
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
                embeds: [genPostEmbed()],
            });
            break;
        case '41': {
            const channel_id = interaction.values[0];
            const index = restricts.findIndex((c) => BigInt(c.channel_id) === BigInt(channel_id));
            if (index < 0) {
                await interaction.update({
                    embeds: [genPostEmbed('This channel is not in the restrict list')],
                    components: [genMenuOptions()],
                });
                return;
            }
            if (index > -1) {
                await DatabaseConnection.manager
                    .remove(restricts[index])
                    .catch((err) => Logger('error', err, interaction));
                restricts.splice(index, 1);
            }
            await interaction.update({ embeds: [genPostEmbed()], components: [genMenuOptions()] });
            break;
        }
        case '5':
            await interaction.update({
                embeds: [genPostEmbed()],
                components: [
                    new ActionRowBuilder()
                        .addComponents(new ChannelSelectMenuBuilder().setCustomId('settings:channel_restrict:51'))
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '51':
            restrict_system.mod_notifier_channel_id = interaction.values[0];
            await DatabaseConnection.manager.save(restrict_system).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.update({ embeds: [genPostEmbed()], components: [genMenuOptions()] });
            break;
        default:
            await interaction.update({ embeds: [genPostEmbed()], components: [genMenuOptions()] });
            break;
    }
};

const exec = async (event_name: string, data: Message | ThreadChannel) => {
    const post = new EmbedBuilder().setTitle(':no_entry: Your message has been deleted').setColor(Colors.Red);
    const is_message = event_name === 'messageCreate';
    const guild_id = is_message ? (data as Message).guild?.id : (data as ThreadChannel).guild?.id;
    const channel_id = is_message ? (data as Message).channel.id : (data as ThreadChannel).parentId;
    const message_id = is_message ? (data as Message).id : (data as ThreadChannel).id;

    const message_logger = await DatabaseConnection.manager.findOne(MessageLogger, {
        where: { from_guild: { gid: BigInt(guild_id) } },
    });

    const restrict_system = await DatabaseConnection.manager
        .findOne(ChannelRestrictSystem, { where: { from_guild: { gid: BigInt(guild_id) } } })
        .catch((err) => {
            Logger('error', err, data);
            return undefined;
        });

    const restrict_list_db = await DatabaseConnection.manager.findOne(ChannelRestricts, {
        where: { from_guild: { gid: BigInt(guild_id) }, channel_id },
    });
    if (!restrict_list_db || !restrict_system || !restrict_system.is_enabled) return;

    const restrict_list = restrict_list_db.restricts.map((r) => parseInt(r) as ChannelRestrictList);

    let is_thread = event_name === 'threadCreate';
    const [is_image, is_video, is_sticker, is_text, is_link] = [
        is_message && (data as Message).attachments.some((att) => att.contentType?.startsWith('image')),
        is_message && (data as Message).attachments.some((att) => att.contentType?.startsWith('video')),
        is_message &&
            ((data as Message).content.match(/https?:\/\/\w+\.discordapp\.net\/stickers\/\w+/) ||
                (data as Message).stickers.size > 0),
        is_message &&
            (data as Message).content.length > 0 &&
            !(data as Message).content.match(/https?:\/\/\S+/) &&
            !(data as Message).reference,
        is_message && ((data as Message).content.match(/https?:\/\/\S+/) ?? false),
    ];

    if ((data as Message).type === 18) is_thread = true;

    const is_restricted = !(
        (is_image && restrict_list.includes(ChannelRestrictList.IMAGE)) ||
        (is_link && restrict_list.includes(ChannelRestrictList.LINK) && !is_sticker) ||
        (is_sticker && restrict_list.includes(ChannelRestrictList.STICKER)) ||
        (is_text && restrict_list.includes(ChannelRestrictList.TEXT)) ||
        (is_thread && restrict_list.includes(ChannelRestrictList.THREAD)) ||
        (is_video && restrict_list.includes(ChannelRestrictList.VIDEO))
    );

    if (is_restricted) {
        post.setDescription(
            `Your message in <#${channel_id}> has been deleted due to channel restrictions.\nAllowed types: ${restrict_list.map((r) => ChannelRestrictList[r]).join(', ')}`
        );

        await data.delete().catch((err) => Logger('error', err, data));

        if (is_message) {
            await (data as Message).author.send({ embeds: [post] }).catch((err) => Logger('error', err, data));
        } else if (is_thread) {
            setTimeout(async () => {
                (await (data as ThreadChannel).parent.messages.fetch({ limit: 10 })).forEach(async (msg) => {
                    if (msg.id === (data as ThreadChannel).id) {
                        msg.delete().catch((err) => {
                            Logger('error', err, data);
                        });
                        return;
                    }
                });
            }, 1000);
            const owner = await (data as ThreadChannel).guild.members.fetch((data as ThreadChannel).ownerId);
            await owner.send({ embeds: [post] }).catch((err) => Logger('error', err, data));
        }
        if (message_logger && restrict_system.mod_notifier_channel_id) {
            const logged_message = await DatabaseConnection.manager.findOne(Messages, {
                where: {
                    from_guild: { gid: BigInt(guild_id) },
                    message_id: BigInt(message_id),
                },
            });
            const mod_post = new EmbedBuilder()
                .setAuthor({
                    name: `${(data as Message).author.username} (${(data as Message).author.id})`,
                    iconURL: (data as Message).author.displayAvatarURL(),
                })
                .setColor(Colors.Yellow)
                .setThumbnail((data as Message).author.displayAvatarURL())
                .setTimestamp();
            mod_post.setDescription(
                `A message in <#${channel_id}> has been deleted due to channel restrictions.\n` +
                    (logged_message
                        ? `Message URL: https://discord.com/channels/${guild_id}/${message_logger.channel_id}/${logged_message.logged_message_id}`
                        : '')
            );
            const channel = (data as ThreadChannel).guild.channels.cache.get(restrict_system.mod_notifier_channel_id);
            await (channel as TextChannel).send({ embeds: [mod_post] }).catch((err) => Logger('error', err, data));
        }
    }
};

export default {
    enabled: true,
    name: 'channel_restrict',
    type: 'customizable',
    description: 'Channel restrict system settings wrapper.',

    category: 'pseudo',
    cooldown: 0,

    usewithevent: ['messageCreate', 'threadCreate'],
    execute_when_event: exec,
    settings: settings,
} as Command_t;
