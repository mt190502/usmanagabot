/* eslint-disable @typescript-eslint/no-unused-vars */
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
    ThreadChannel,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { ChannelRestricts, ChannelRestrictSystem } from '../../types/database/channel_restrict';
import { Guilds } from '../../types/database/guilds';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

enum ChannelRestrictList {
    IMAGE_ONLY = 1,
    TEXT_ONLY,
    LINK_ONLY,
    THREAD_ONLY,
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
    if (restrict_system === undefined) return;

    if (!restrict_system) {
        const new_restrict = new ChannelRestrictSystem();
        new_restrict.from_guild = await DatabaseConnection.manager
            .findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        new_restrict.from_user = await DatabaseConnection.manager
            .findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        await DatabaseConnection.manager.save(new_restrict).catch((err) => {
            Logger('error', err, interaction);
        });
        return settings(interaction);
    }

    const restricts = await DatabaseConnection.manager.find(ChannelRestricts, {
        where: { from_guild: { gid: BigInt(interaction.guild.id) } },
    });

    const user = await DatabaseConnection.manager.findOne(Users, {
        where: { uid: BigInt(interaction.user.id) },
    });

    const guild = await DatabaseConnection.manager.findOne(Guilds, {
        where: { gid: BigInt(interaction.guild.id) },
    });

    let restrict_system_status = restrict_system.is_enabled ? 'Disable' : 'Enable';
    const channel_select_menu = new ChannelSelectMenuBuilder()
        .setCustomId('settings:channel_restrict:21')
        .setPlaceholder('Select a channel');

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
                value: restrict_system.is_enabled
                    ? restricts.length > 0
                        ? restricts.map((channel) => `<#${channel.channel_id}>`).join(', ')
                        : 'None'
                    : 'None',
            }
        );
        post.addFields(fields);
        return post;
    };

    const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
        const menu = new StringSelectMenuBuilder().setCustomId('settings:channel_restrict:0').addOptions([
            {
                label: `${restrict_system_status} Channel Restrict System`,
                description: `${restrict_system_status} the channel restrict system`,
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
                label: 'Back',
                description: 'Return to the main settings menu',
                value: 'settings',
            },
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
            restrict_system_status = restrict_system.is_enabled ? 'Disable' : 'Enable';
            await DatabaseConnection.manager.save(restrict_system).catch((err) => {
                Logger('error', err, interaction);
            });

            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        case '2':
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            channel_select_menu
                                .setCustomId('settings:channel_restrict:21')
                                .addChannelTypes(ChannelType.GuildText)
                        )
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
                embeds: [genPostEmbed()],
            });
            break;
        case '21': {
            if (restricts.find((channel) => channel.channel_id === interaction.values[0])) {
                await interaction.update({
                    embeds: [genPostEmbed('This channel is already in the restrict list')],
                    components: [genMenuOptions()],
                });
                return;
            }

            restricts.push(
                (() => {
                    const new_restrict = new ChannelRestricts();
                    new_restrict.from_guild = guild;
                    new_restrict.from_user = user;
                    new_restrict.channel_id = interaction.values[0];
                    return new_restrict;
                })()
            );

            await DatabaseConnection.manager.save(restricts).catch((err) => {
                Logger('error', err, interaction);
            });

            await interaction.update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        }
        case '3':
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder().setCustomId('settings:channel_restrict:31').addOptions(
                                ...restricts.map((channel) => ({
                                    label: interaction.guild.channels.cache.get(channel.channel_id)?.name,
                                    description:
                                        channel.restricts.length > 0
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
                .setMinValues(1)
                .setMaxValues(Object.keys(ChannelRestrictList).filter((key) => !isNaN(Number(key))).length)
                .addOptions(
                    ...Object.values(ChannelRestrictList)
                        .filter((value) => typeof value === 'number')
                        .map((restrict) => ({
                            label: ChannelRestrictList[restrict as number],
                            description: Object.keys(ChannelRestrictList)[(restrict as number) - 1],
                            value: `settings:channel_restrict:32/${channel_id}/${restrict}`,
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

            for (const restrict of interaction.values) {
                const requested_restrict = restrict.split('/')[2];

                if (channel.restricts.includes(requested_restrict)) {
                    channel.restricts = channel.restricts.filter((r) => r !== requested_restrict);
                } else {
                    channel.restricts.push(requested_restrict);
                }
            }

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
                            channel_select_menu
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
            const channel = restricts.find((c) => BigInt(c.channel_id) === BigInt(channel_id));
            if (!channel) {
                await interaction.update({
                    embeds: [genPostEmbed('Channel is not in the restrict list')],
                    components: [genMenuOptions()],
                });
                return;
            }

            const index = restricts.indexOf(channel);
            if (index > -1) {
                restricts.splice(index, 1);
            }

            await DatabaseConnection.manager.remove(channel).catch((err) => {
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

const exec = async (event_name: string, data: Message | ThreadChannel) => {
    const post = new EmbedBuilder();
    let restrict_system: ChannelRestrictSystem;
    let restrict_list: ChannelRestrictList[] = [];

    let message_is_image = false;
    let message_is_text = false;
    let message_is_link = false;
    let message_is_thread = false;

    switch (event_name) {
        case 'messageCreate': {
            const message = data as Message;
            restrict_system = await DatabaseConnection.manager
                .findOne(ChannelRestrictSystem, {
                    where: { from_guild: { gid: BigInt(message.guild?.id) } },
                })
                .catch((err) => {
                    Logger('error', err, message);
                    return undefined;
                });
            const restrict_list_db = await DatabaseConnection.manager.findOne(ChannelRestricts, {
                where: { from_guild: { gid: BigInt(message.guild?.id) }, channel_id: message.channel.id },
            });
            if (!restrict_list_db) return;
            restrict_list = restrict_list_db.restricts.map((r) => parseInt(r) as ChannelRestrictList);

            message_is_image = message.attachments.some((attachment) => attachment.contentType?.startsWith('image'));
            message_is_link = message.content.match(/https?:\/\/\S+/) !== null;
            message_is_text = message.content.length > 0 && !message_is_image && !message_is_link;
            break;
        }
        case 'threadCreate': {
            const thread = data as ThreadChannel;
            restrict_system = await DatabaseConnection.manager
                .findOne(ChannelRestrictSystem, {
                    where: { from_guild: { gid: BigInt(thread.guild?.id) } },
                })
                .catch((err) => {
                    Logger('error', err, thread);
                    return undefined;
                });
            const restrict_list_db = await DatabaseConnection.manager.findOne(ChannelRestricts, {
                where: { from_guild: { gid: BigInt(thread.guild?.id) }, channel_id: thread.parentId },
            });
            restrict_list = restrict_list_db.restricts.map((r) => parseInt(r) as ChannelRestrictList);
            message_is_thread = true;
            break;
        }
    }
    if (restrict_list.length === 0) return;
    console.log(
        `====================\nImage: ${message_is_image}\nText: ${message_is_text}\nLink: ${message_is_link}\nThread: ${message_is_thread}`
    );

    const allowed_content_types = restrict_list
        .map((type) => {
            switch (type) {
                case ChannelRestrictList.IMAGE_ONLY:
                    return 'Image';
                case ChannelRestrictList.TEXT_ONLY:
                    return 'Text';
                case ChannelRestrictList.LINK_ONLY:
                    return 'Link';
                case ChannelRestrictList.THREAD_ONLY:
                    return 'Thread';
                default:
                    return '';
            }
        })
        .join(', ');

    const is_allowed_content =
        (message_is_image && restrict_list.includes(ChannelRestrictList.IMAGE_ONLY)) ||
        (message_is_text && restrict_list.includes(ChannelRestrictList.TEXT_ONLY)) ||
        (message_is_link && restrict_list.includes(ChannelRestrictList.LINK_ONLY)) ||
        (message_is_thread && restrict_list.includes(ChannelRestrictList.THREAD_ONLY));

    if (is_allowed_content) return;

    post.setTitle(':no_entry: Your message has been deleted').setColor(Colors.Red);

    if (event_name == 'messageCreate') {
        post.setDescription(
            `Channel <#${(data as Message).channel.id}> only allows the following content types: ${allowed_content_types}`
        );
        await data.delete().catch((err) => {
            Logger('error', err, data);
        });
        await (data as Message).author.send({
            embeds: [post],
        });
    } else if (event_name == 'threadCreate') {
        post.setDescription(
            `Channel <#${(data as ThreadChannel).parentId}> only allows the following content types: ${allowed_content_types}`
        );
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
        await (data as ThreadChannel).delete().catch((err) => {
            Logger('error', err, data);
        });
        const owner = await (data as ThreadChannel).guild.members.fetch((data as ThreadChannel).ownerId);
        await owner.send({
            embeds: [post],
        });
    }
};

export default {
    enabled: true,
    name: 'channel_restrict',
    type: 'customizable',
    description: 'Channel restrict system settings wrapper.',

    category: 'pseudo',
    cooldown: 0,
    usage: '/settings',

    usewithevent: ['messageCreate', 'threadCreate'],
    execute_when_event: exec,
    settings: settings,
} as Command_t;
