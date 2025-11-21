import {
    ActionRowBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    Colors,
    EmbedBuilder,
    Events,
    Message,
    MessageType,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ThreadChannel,
    User,
} from 'discord.js';
import timers from 'timers/promises';
import { ChannelRestricts, ChannelRestrictSystem, RestrictType } from '../../types/database/entities/channel_restrict';
import { MessageLogger } from '../../types/database/entities/message_logger';
import { Messages } from '../../types/database/entities/messages';
import { ChainEvent } from '../../types/decorator/chainevent';
import { SettingChannelMenuComponent, SettingGenericSettingComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class ChannelRestrictCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'channel_restrict', is_admin_command: true });
        this.base_cmd_data = null;
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let restrict = await this.db.findOne(ChannelRestrictSystem, { where: { from_guild: guild! } });
        if (!restrict) {
            const new_settings = new ChannelRestrictSystem();
            new_settings.is_enabled = false;
            new_settings.latest_action_from_user = system_user!;
            new_settings.from_guild = guild!;
            restrict = await this.db.save(new_settings);
            this.log.send('log', 'command.prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = restrict.is_enabled;
        this.log.send('debug', 'command.prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @ChainEvent({ type: Events.MessageCreate })
    @ChainEvent({ type: Events.ThreadCreate })
    public async execute(message: Message<true> | ThreadChannel): Promise<void> {
        if (!message.guild || (message instanceof Message && message.author.bot)) return;
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'channelrestrict',
            event: message instanceof Message ? 'MessageCreate' : 'ThreadCreate',
            guild: message.guild,
            user: message instanceof Message ? message.author : (await message.fetchOwner())!.user,
        });
        const restrict = await this.db.findOne(ChannelRestrictSystem, {
            where: { from_guild: { gid: BigInt(message.guild!.id) } },
        });
        const restrict_list = await this.db.find(ChannelRestricts, {
            where: { from_guild: { gid: BigInt(message.guild!.id) } },
        });
        const msg_logger = await this.db.findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(message.guild!.id) } },
        });
        if (!restrict_list || !restrict || !restrict.is_enabled) {
            this.log.send('debug', 'command.configuration.missing', { name: this.name, guild: message.guild });
            return;
        }

        const post = new EmbedBuilder()
            .setTitle(`:no_entry: ${this.t('channel_restrict.execute.message_deleted')}`)
            .setColor(Colors.Red);
        const guild_id = message.guild!.id;
        const message_id = message.id;
        let author: User;
        let channel_id: string;
        let channel: ChannelRestricts;
        let [is_image, is_video, is_sticker, is_text, is_link, is_thread] = [
            false,
            false,
            false,
            false,
            false,
            false,
            false,
        ];

        if (message instanceof Message) {
            author = message.author;
            channel_id = message.channel.id;
            channel = restrict_list.find((c) => c.channel_id === channel_id)!;
            if (!channel) return;
            is_image = message.attachments.some((att) => att.contentType?.startsWith('image'));
            is_video = message.attachments.some((att) => att.contentType?.startsWith('video'));
            is_sticker =
                !!message.content.match(/https?:\/\/\w+\.discordapp\.net\/stickers\/\w+/) || message.stickers.size > 0;
            is_text = message.content.length > 0 && !message.content.match(/https?:\/\/\S+/) && !message.reference;
            is_link = !!message.content.match(/https?:\/\/\S+/);
            if (message.type === MessageType.ThreadCreated) is_thread = true;
        } else {
            author = (await message.fetchOwner())!.user!;
            channel_id = message.id;
            channel = restrict_list.find((c) => c.channel_id === channel_id)!;
            if (!channel) return;
            is_thread = true;
        }

        const is_restricted = !(
            (is_image && channel.restricts.includes(RestrictType.IMAGE)) ||
            (is_link && channel.restricts.includes(RestrictType.LINK) && !is_sticker) ||
            (is_sticker && channel.restricts.includes(RestrictType.STICKER)) ||
            (is_text && channel.restricts.includes(RestrictType.TEXT)) ||
            (is_thread && channel.restricts.includes(RestrictType.THREAD)) ||
            (is_video && channel.restricts.includes(RestrictType.VIDEO))
        );

        if (is_restricted) {
            post.setDescription(
                this.t('channel_restrict.execute.message_deleted_description', {
                    channel: `<#${channel_id}>`,
                    restrictions: channel.restricts.map((r) => RestrictType[r]).join(', '),
                }),
            );

            if (message.type === MessageType.ThreadCreated) {
                setTimeout(async () => {
                    if (!message.thread) return;
                    const thread = await message.guild!.channels.fetch(message.thread.id);
                    if (thread && 'delete' in thread) await thread.delete();
                }, 2500);
            }
            await message.delete();

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
                    this.t('channel_restrict.execute.admin_post', {
                        channel_id,
                        message_url: logged?.logged_message_id
                            ? `Message URL: https://discord.com/channels/${guild_id}/${msg_logger.channel_id}/${logged.logged_message_id}`
                            : '-',
                        restrictions: channel.restricts.map((r) => RestrictType[r]).join(', '),
                    }),
                );
                if (target && 'send' in target) await target.send({ embeds: [mod_post] });
            }
        }
    }

    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @SettingGenericSettingComponent({
        database: ChannelRestrictSystem,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
        const restrict = await this.db.findOne(ChannelRestrictSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        restrict!.is_enabled = !restrict!.is_enabled;
        restrict!.latest_action_from_user = user;
        restrict!.timestamp = new Date();
        this.enabled = restrict!.is_enabled;
        await this.db.save(ChannelRestrictSystem, restrict!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    @SettingChannelMenuComponent({
        options: {
            channel_types: [ChannelType.GuildText],
        },
        view_in_ui: false,
    })
    public async addChannel(interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.channelrestrict.addchannel.start', {
            name: this.name,
            guild: interaction.guild,
        });
        const restricts = await this.db.find(ChannelRestricts, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        if (restricts.find((channel) => channel.channel_id === interaction.values[0])) {
            this.warning = this.t('channel_restrict.settings.addchannel.already_added', { channel: `<#${interaction.values[0]}>` });
            this.log.send('warn', 'command.channelrestrict.addchannel.exists', {
                guild: interaction.guild,
                channel_id: interaction.values[0],
            });
            await this.settingsUI(interaction);
            return;
        }
        const channel = new ChannelRestricts();
        channel.channel_id = interaction.values[0];
        channel.latest_action_from_user = user;
        channel.timestamp = new Date();
        channel.from_guild = (await this.db.getGuild(BigInt(interaction.guildId!)))!;
        await this.db.save(ChannelRestricts, channel);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.channelrestrict.addchannel.success', {
            guild: interaction.guild,
            channel: interaction.values[0],
        });
    }

    @SettingGenericSettingComponent({
        database: ChannelRestricts,
        database_key: 'channel_id',
        format_specifier: '<#%s>',
        db_column_is_array: true,
    })
    public async defineChannelRestrictions(interaction: StringSelectMenuInteraction, ...args: string[]): Promise<void> {
        this.log.send('debug', 'command.channelrestrict.definechannelrestrictions.start', { guild: interaction.guild });
        const restricts = await this.db.find(ChannelRestricts, {
            where: { from_guild: { gid: BigInt(interaction.guild!.id) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        if (args.length > 1) {
            const channel_id = args[0];
            const channel = restricts.find((c) => BigInt(c.channel_id) === BigInt(channel_id));
            channel!.restricts = interaction.values.map((v) => v.split(':').pop()! as unknown as RestrictType);
            channel!.latest_action_from_user = user;
            channel!.timestamp = new Date();
            await this.db.save(ChannelRestricts, channel!);
            await this.settingsUI(interaction);
            this.log.send('debug', 'command.channelrestrict.definechannelrestrictions.success', {
                guild: interaction.guild,
                restrictions: restricts
                    .find((c) => BigInt(c.channel_id) === BigInt(channel_id))
                    ?.restricts.map((r) => RestrictType[r])
                    .join(', '),
            });
        } else if (args.length == 1) {
            await interaction.update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('settings:channelrestrict:definechannelrestrictions')
                                .setPlaceholder(this.t('channel_restrict.settings.definechannelrestrictions.restricts.placeholder'))
                                .setMaxValues(Object.keys(RestrictType).filter((key) => !isNaN(Number(key))).length)
                                .addOptions(
                                    ...Object.values(RestrictType)
                                        .filter((value) => typeof value === 'number')
                                        .map((restrict) => ({
                                            label: RestrictType[restrict],
                                            description: Object.keys(RestrictType)[restrict - 1],
                                            value: `settings:channel_restrict:definechannelrestrictions:${args[0]}:${restrict}`,
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
                                .setPlaceholder(this.t('channel_restrict.settings.definechannelrestrictions.channels.placeholder'))
                                .addOptions(
                                    ...restricts.map((channel) => ({
                                        label: interaction.guild!.channels.cache.get(channel.channel_id)!.name,
                                        description: channel.restricts.length
                                            ? channel.restricts.map((r) => RestrictType[r]).join(', ')
                                            : '-',
                                        value: `settings:channel_restrict:definechannelrestrictions:${channel.channel_id}`,
                                    })),
                                    {
                                        label: this.t('channel_restrict.settings.definechannelrestrictions.back'),
                                        description: this.t('channel_restrict.settings.definechannelrestrictions.back_description'),
                                        value: 'settings:channelrestrict',
                                    },
                                ),
                        )
                        .toJSON(),
                ],
            });
        }
    }

    @SettingChannelMenuComponent({
        view_in_ui: false,
        options: {
            channel_types: [ChannelType.GuildText],
        },
    })
    public async removeChannel(interaction: ChannelSelectMenuInteraction | StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.channelrestrict.removechannel.start', { guild: interaction.guild });
        const restricts = await this.db.find(ChannelRestricts, {
            where: { from_guild: { gid: BigInt(interaction.guild!.id) } },
        });
        const restrict = await this.db.findOne(ChannelRestrictSystem, {
            where: { from_guild: { gid: BigInt(interaction.guild!.id) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const selected = restricts.find((channel) => channel.channel_id === interaction.values[0]);
        if (!selected) {
            this.warning = this.t('channel_restrict.settings.removechannel.not_found', { channel: `<#${interaction.values[0]}>` });
            this.log.send('warn', 'command.channelrestrict.removechannel.not_found', {
                guild: interaction.guild,
                channel_id: interaction.values[0],
            });
            await this.settingsUI(interaction);
            return;
        }
        await this.db.remove(ChannelRestricts, selected);
        restrict!.latest_action_from_user = user;
        restrict!.timestamp = new Date();
        await this.db.save(ChannelRestrictSystem, restrict!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.channelrestrict.removechannel.success', {
            guild: interaction.guild,
            channel_id: interaction.values[0],
        });
    }

    @SettingChannelMenuComponent({
        database: ChannelRestrictSystem,
        database_key: 'mod_notifier_channel_id',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
        },
    })
    public async changeModNotifierChannel(
        interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.channelrestrict.changenotifierchannel.start', { guild: interaction.guild });
        const restrict = await this.db.findOne(ChannelRestrictSystem, {
            where: { from_guild: { gid: BigInt(interaction.guild!.id) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        restrict!.mod_notifier_channel_id = interaction.values[0];
        restrict!.latest_action_from_user = user;
        restrict!.timestamp = new Date();
        await this.db.save(ChannelRestrictSystem, restrict!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.channelrestrict.changenotifierchannel.success', {
            guild: interaction.guild,
            channel: restrict!.mod_notifier_channel_id,
        });
    }
    // ================================================================ //
}
