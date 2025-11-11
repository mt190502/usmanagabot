import {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    Colors,
    EmbedBuilder,
    Events,
    Message,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ThreadChannel,
    User,
} from 'discord.js';
import timers from 'timers/promises';
import { ChannelRestricts, ChannelRestrictSystem, RestrictType } from '../../types/database/entities/channel_restrict';
import { MessageLogger } from '../../types/database/entities/message_logger';
import { Messages } from '../../types/database/entities/messages';
import { ChainEvent } from '../../types/decorator/callEvent';
import { CommandSetting } from '../../types/decorator/command';
import { CustomizableCommand } from '../../types/structure/command';

export default class ChannelRestrictCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'channelrestrict',
            pretty_name: 'Channel Restrict',
            description: 'Restrict message types in a specific channel',
            is_admin_command: true,
            help: `
                Restrict certain types of messages in a specific channel.

                **Usage:**
                - \`No Usage\`

                **Options:**
                - \`No Options\`
                
                **Example:**
                - \`No Example\`
            `,
        });
        this.base_cmd_data = null;
    }

    public async generateSlashCommandData(guild_id: bigint): Promise<void> {
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let restrict = await this.db.findOne(ChannelRestrictSystem, { where: { from_guild: guild! } });
        if (!restrict) {
            const new_settings = new ChannelRestrictSystem();
            new_settings.is_enabled = false;
            new_settings.from_user = system_user!;
            new_settings.from_guild = guild!;
            restrict = await this.db.save(new_settings);
        }
        this.enabled = restrict.is_enabled;
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @ChainEvent({ type: Events.MessageCreate })
    @ChainEvent({ type: Events.ThreadCreate })
    public async execute(message: Message | ThreadChannel): Promise<void> {
        if (!message.guild) return;
        const restrict = await this.db.findOne(ChannelRestrictSystem, {
            where: { from_guild: { gid: BigInt(message.guild!.id) } },
        });
        const restrict_list = await this.db.find(ChannelRestricts, {
            where: { from_guild: { gid: BigInt(message.guild!.id) } },
        });
        const msg_logger = await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(message.guild!.id) } },
        });
        if (!restrict_list || !restrict || !restrict.is_enabled) return;

        const post = new EmbedBuilder().setTitle(':no_entry: Your message has been deleted').setColor(Colors.Red);
        const guild_id = message.guild!.id;
        const message_id = message.id;
        let author: User;
        let channel_id: string;
        let channel: ChannelRestricts;
        let [is_image, is_video, is_sticker, is_text, is_link, is_restricted] = [
            false,
            false,
            false,
            false,
            false,
            false,
        ];

        if (message instanceof Message) {
            if (message.author.bot) return;
            author = message.author;
            channel_id = message.channel.id;
            channel = restrict_list.find((c) => c.channel_id === channel_id)!;
            is_image = message.attachments.some((att) => att.contentType?.startsWith('image'));
            is_video = message.attachments.some((att) => att.contentType?.startsWith('video'));
            is_sticker =
                !!message.content.match(/https?:\/\/\w+\.discordapp\.net\/stickers\/\w+/) || message.stickers.size > 0;
            is_text = message.content.length > 0 && !message.content.match(/https?:\/\/\S+/) && !message.reference;
            is_link = !!message.content.match(/https?:\/\/\S+/);
            is_restricted = !(
                (is_image && channel.restricts.includes(RestrictType.IMAGE)) ||
                (is_link && channel.restricts.includes(RestrictType.LINK) && !is_sticker) ||
                (is_sticker && channel.restricts.includes(RestrictType.STICKER)) ||
                (is_text && channel.restricts.includes(RestrictType.TEXT)) ||
                (is_video && channel.restricts.includes(RestrictType.VIDEO))
            );
        } else {
            author = message.guild.members.cache.get(message.ownerId)!.user;
            channel_id = message.parentId!;
            channel = restrict_list.find((c) => c.channel_id === channel_id)!;
            is_restricted = channel.restricts.includes(RestrictType.THREAD);
        }

        if (is_restricted) {
            post.setDescription(
                `Your message in <#${channel_id}> has been deleted due to channel restrictions.\nAllowed types: ${channel.restricts.map((r) => RestrictType[r]).join(', ')}`,
            );
            await message.delete();

            if (channel.restricts.includes(RestrictType.THREAD) && message instanceof ThreadChannel) {
                setTimeout(async () => {
                    if (message.parent && 'messages' in message.parent) {
                        const messages = await message.parent.messages.fetch({ limit: 10 });
                        for (const msg of messages.values()) {
                            if (msg.id === message.id) {
                                await msg.delete();
                                break;
                            }
                        }
                    }
                }, 1000);
            }
            await author.send({ embeds: [post] });
            if (msg_logger && restrict.mod_notifier_channel_id) {
                await timers.setTimeout(500);
                const logged = await this.db.findOne(Messages, {
                    where: {
                        from_guild: { gid: BigInt(guild_id) },
                        message_id: BigInt(message_id),
                    },
                });
                const target = message.guild!.channels.cache.get(restrict.mod_notifier_channel_id);
                const mod_post = new EmbedBuilder()
                    .setAuthor({
                        name: `${author.username} (${author.id})`,
                        iconURL: author.displayAvatarURL(),
                    })
                    .setColor(Colors.Yellow)
                    .setThumbnail(author.displayAvatarURL())
                    .setTimestamp();
                mod_post.setDescription(
                    `A message in <#${channel_id}> has been deleted due to channel restrictions.\n` +
                        (logged?.logged_message_id
                            ? `Message URL: https://discord.com/channels/${guild_id}/${msg_logger.channel_id}/${logged.logged_message_id}`
                            : ''),
                );
                if (target && 'send' in target) await target.send({ embeds: [mod_post] });
            }
        }
    }

    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @CommandSetting({
        display_name: 'Enabled',
        database: ChannelRestrictSystem,
        database_key: 'is_enabled',
        pretty: 'Toggle Restrict System',
        description: 'Toggle the restrict system enabled/disabled.',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        const restrict = await this.db.findOne(ChannelRestrictSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        restrict!.is_enabled = !restrict!.is_enabled;
        this.enabled = restrict!.is_enabled;
        await this.db.save(ChannelRestrictSystem, restrict!);
        await this.settingsUI(interaction);
    }

    @CommandSetting({
        pretty: 'Add Channel',
        description: 'Add a channel to the restrict system.',
    })
    public async addChannel(interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction): Promise<void> {
        const restricts = await this.db.find(ChannelRestricts, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });

        if (interaction.isChannelSelectMenu()) {
            if (restricts.find((channel) => channel.channel_id === interaction.values[0])) {
                this.warning = 'This channel is already added to the restrict system.';
                await this.settingsUI(interaction);
                return;
            }
            const channel = new ChannelRestricts();
            channel.channel_id = interaction.values[0];
            channel.from_user = (await this.db.getUser(BigInt(interaction.user.id)))!;
            channel.from_guild = (await this.db.getGuild(BigInt(interaction.guildId!)))!;
            await this.db.save(ChannelRestricts, channel);
            await this.settingsUI(interaction);
        }
        if (interaction.isStringSelectMenu()) {
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId('settings:channelrestrict:addchannel')
                                .addChannelTypes(ChannelType.GuildText),
                        )
                        .toJSON(),
                ],
            });
        }
    }

    @CommandSetting({
        display_name: 'Restricted Channels',
        database: ChannelRestricts,
        database_key: 'channel_id',
        pretty: 'Define or Edit Channel Restrictions',
        description: 'Define or edit the restrictions for a specific channel.',
        format_specifier: '<#%s>',
        db_column_is_array: true,
    })
    public async defineChannelRestrictions(interaction: StringSelectMenuInteraction, ...args: string[]): Promise<void> {
        const restricts = await this.db.find(ChannelRestricts, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        if (args.length > 1) {
            const channel_id = args[0];
            const channel = restricts.find((c) => BigInt(c.channel_id) === BigInt(channel_id));
            channel!.restricts = interaction.values.map((v) => v.split(':').pop()! as unknown as RestrictType);
            await this.db.save(ChannelRestricts, channel!);
            await this.settingsUI(interaction);
        } else if (args.length == 1) {
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('settings:channelrestrict:definechannelrestrictions')
                                .setMaxValues(Object.keys(RestrictType).filter((key) => !isNaN(Number(key))).length)
                                .addOptions(
                                    ...Object.values(RestrictType)
                                        .filter((value) => typeof value === 'number')
                                        .map((restrict) => ({
                                            label: RestrictType[restrict],
                                            description: Object.keys(RestrictType)[restrict - 1],
                                            value: `settings:channelrestrict:definechannelrestrictions:${args[0]}:${restrict}`,
                                            default: restricts
                                                .find((c) => BigInt(c.channel_id) === BigInt(args[0]))
                                                ?.restricts.includes(restrict),
                                        })),
                                ),
                        )
                        .toJSON(),
                ],
            });
        } else {
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('settings:channelrestrict:definechannelrestrictions')
                                .addOptions(
                                    ...restricts.map((channel) => ({
                                        label: interaction.guild!.channels.cache.get(channel.channel_id)!.name,
                                        description: channel.restricts.length
                                            ? channel.restricts.map((r) => RestrictType[r]).join(', ')
                                            : 'None',
                                        value: `settings:channelrestrict:definechannelrestrictions:${channel.channel_id}`,
                                    })),
                                    {
                                        label: 'Back',
                                        description: 'Return to the previous menu',
                                        value: 'settings:channelrestrict',
                                    },
                                ),
                        )
                        .toJSON(),
                ],
            });
        }
    }

    @CommandSetting({
        pretty: 'Remove Channel from Restrict System',
        description: 'Remove a channel from the restrict system.',
    })
    public async removeChannel(interaction: ChannelSelectMenuInteraction | StringSelectMenuInteraction): Promise<void> {
        const restricts = await this.db.find(ChannelRestricts, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });

        if (interaction.isChannelSelectMenu()) {
            const selected = restricts.find((channel) => channel.channel_id === interaction.values[0]);
            if (!selected) {
                this.warning = 'This channel is not in the restrict system.';
                await this.settingsUI(interaction);
                return;
            }
            await this.db.remove(ChannelRestricts, selected);
            await this.settingsUI(interaction);
        }
        if (interaction.isStringSelectMenu()) {
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId('settings:channelrestrict:removechannel')
                                .addChannelTypes(ChannelType.GuildText),
                        )
                        .toJSON(),
                ],
            });
        }
    }

    @CommandSetting({
        display_name: 'Notifier Channel',
        database: ChannelRestrictSystem,
        database_key: 'mod_notifier_channel_id',
        pretty: 'Set Notifier Channel',
        description: 'Set the channel where moderation actions will be reported.',
        format_specifier: '<#%s>',
    })
    public async changeModNotifierChannel(
        interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    ): Promise<void> {
        const restrict = await this.db.findOne(ChannelRestrictSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });

        if (interaction.isChannelSelectMenu()) {
            restrict!.mod_notifier_channel_id = interaction.values[0];
            await this.db.save(ChannelRestrictSystem, restrict!);
            await this.settingsUI(interaction);
        }
        if (interaction.isStringSelectMenu()) {
            await interaction.update({
                components: [
                    new ActionRowBuilder<ChannelSelectMenuBuilder>()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId('settings:channelrestrict:changemodnotifierchannel')
                                .setPlaceholder('Select a channel')
                                .setChannelTypes(ChannelType.GuildText),
                        )
                        .toJSON(),
                ],
            });
        }
    }
    // ================================================================ //
}
