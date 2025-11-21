import {
    ActionRowBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    Events,
    GuildMember,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    RoleSelectMenuInteraction,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { BotClient } from '../../services/client';
import { Guilds } from '../../types/database/entities/guilds';
import { Verification, VerificationSystem } from '../../types/database/entities/verification';
import { ChainEvent } from '../../types/decorator/chainevent';
import { Cron } from '../../types/decorator/cronjob';
import {
    SettingChannelMenuComponent,
    SettingGenericSettingComponent,
    SettingRoleSelectMenuComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class VerificationCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'verification', is_admin_command: true });
        this.base_cmd_data = null;
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let verification_system = await this.db.findOne(VerificationSystem, { where: { from_guild: guild! } });
        if (!verification_system) {
            verification_system = new VerificationSystem();
            verification_system.is_enabled = false;
            verification_system.from_guild = guild!;
            verification_system.latest_action_from_user = system_user!;
            verification_system = await this.db.save(VerificationSystem, verification_system);
            this.log.send('log', 'command.prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = verification_system.is_enabled;
        this.log.send('debug', 'command.prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @Cron({ schedule: '* * * * *' })
    public async routineCheck(): Promise<void> {
        this.log.send('debug', 'command.cronjob.start', { name: 'routineCheck' });
        const guilds = await this.db.find(Guilds);
        const client = BotClient.client;
        for (const guild of guilds) {
            const verification_system = await this.db.findOne(VerificationSystem, { where: { from_guild: guild } });
            if (!verification_system || !verification_system.is_enabled) continue;
            const verifications = await this.db.find(Verification, {
                where: { from_guild: guild },
            });
            for (const verification of verifications) {
                if (verification.remaining_time.getTime() <= Date.now()) {
                    const g = client.guilds.cache.get(guild.gid.toString());
                    if (!g) continue;
                    const member = await g.members.fetch(verification.from_user.uid.toString()).catch(() => null);
                    if (!member) continue;
                    member.roles.remove(verification_system.role_id);
                    await this.db.delete(Verification, { id: verification.id });
                }
            }
        }
        this.log.send('debug', 'command.cronjob.success', { name: 'routineCheck' });
    }

    public async execute(member: GuildMember): Promise<{
        message: { key: string; value: string }[];
        verification_system: VerificationSystem;
        verification: Verification;
    }> {
        this.log.send('debug', 'command.execute.start', { name: this.name, guild: member.guild, member: member });
        const guild = await this.db.getGuild(BigInt(member.guild.id));
        const user = await this.db.getUser(BigInt(member.id));
        const verification_system = (await this.db.findOne(VerificationSystem, { where: { from_guild: guild! } }))!;
        const verification =
            (await this.db.findOne(Verification, { where: { from_user: user!, from_guild: guild! } })) ||
            new Verification();
        const message = [
            { key: '{{user}}', value: `<@${member.id}>` },
            { key: '{{user_id}}', value: member.id },
            { key: '{{guild}}', value: member.guild.name },
            { key: '{{minimum_age}}', value: verification_system.minimum_days.toString() },
        ];
        this.log.send('debug', 'command.execute.success', { name: this.name, guild: member.guild, member: member });
        return { message, verification_system, verification };
    }

    @ChainEvent({ type: Events.GuildMemberAdd })
    public async onMemberAdd(member: GuildMember): Promise<void> {
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'verification',
            event: 'GuildMemberAdd',
            guild: member.guild,
            member: member,
        });
        const { message, verification_system, verification } = await this.execute(member);
        if (!verification_system || !verification_system.is_enabled) return;
        if (member.user.createdTimestamp >= Date.now() - verification_system.minimum_days * 86400000) {
            const post_message = message.reduce(
                (msg, replacement) => msg.replaceAll(replacement.key, replacement.value),
                verification_system.message,
            );
            member.roles.add(verification_system.role_id);
            verification.user_created_at = new Date(member.user.createdTimestamp);
            verification.remaining_time = new Date(Date.now() + verification_system.minimum_days * 86400000);
            verification.from_user = (await this.db.getUser(BigInt(member.id)))!;
            verification.from_guild = (await this.db.getGuild(BigInt(member.guild.id)))!;
            await this.db.save(Verification, verification);
            const channel = BotClient.client.channels.cache.get(verification_system.channel_id);
            if (channel!.isSendable()) channel.send({ content: post_message });
        }
        this.log.send('debug', 'command.event.trigger.success', {
            name: 'verification',
            event: 'GuildMemberAdd',
            guild: member.guild,
            member: member,
        });
    }

    @ChainEvent({ type: Events.GuildMemberRemove })
    public async onMemberRemove(member: GuildMember): Promise<void> {
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'verification',
            event: 'GuildMemberRemove',
            guild: member.guild,
            member: member,
        });
        const { verification_system, verification } = await this.execute(member);
        if (!verification_system || !verification_system.is_enabled) return;
        if (!verification.id) return;
        await this.db.delete(Verification, { id: verification.id });
        this.log.send('debug', 'command.event.trigger.success', {
            name: 'verification',
            event: 'GuildMemberRemove',
            guild: member.guild,
            member: member,
        });
        return;
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @SettingGenericSettingComponent({
        database: VerificationSystem,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
        const verification_system = await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        verification_system!.is_enabled = !verification_system!.is_enabled;
        verification_system!.latest_action_from_user = user;
        verification_system!.timestamp = new Date();
        this.enabled = verification_system!.is_enabled;
        await this.db.save(VerificationSystem, verification_system!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    @SettingChannelMenuComponent({
        database: VerificationSystem,
        database_key: 'channel_id',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
        },
    })
    public async setTargetChannel(
        interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.setting.channel.start', { name: this.name, guild: interaction.guild });
        const verification_system = (await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        }))!;
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const selected_channel = interaction.values[0];
        verification_system.channel_id = selected_channel;
        verification_system!.latest_action_from_user = user;
        verification_system!.timestamp = new Date();
        await this.db.save(VerificationSystem, verification_system);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.channel.success', {
            name: this.name,
            guild: interaction.guild,
            channel: selected_channel,
        });
    }

    @SettingRoleSelectMenuComponent({
        database: VerificationSystem,
        database_key: 'role_id',
        format_specifier: '<@&%s>',
    })
    public async setVerificationRole(
        interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.setting.role.start', { name: this.name, guild: interaction.guild });
        const verification_system = await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const server_roles = interaction.guild!.roles.cache.sort((a, b) => b.position - a.position);
        const bot_role = server_roles.find((r) => r.name === BotClient.client.user!.username)!;
        const requested_role = server_roles.get(interaction.values[0])!;

        if (requested_role.position >= bot_role.position) {
            this.warning = this.t('verification.settings.setverificationrole.role_hierarchy_error');
            await this.settingsUI(interaction);
            return;
        }
        verification_system!.role_id = requested_role.id;
        verification_system!.latest_action_from_user = user;
        verification_system!.timestamp = new Date();
        await this.db.save(VerificationSystem, verification_system!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.role.success', {
            name: this.name,
            guild: interaction.guild,
            role: verification_system!.role_id,
        });
    }

    @SettingGenericSettingComponent({
        database: VerificationSystem,
        database_key: 'message',
        format_specifier: '```\n%s\n```',
    })
    public async setVerificationSystemMessage(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const verification_system = await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const message_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('verification_system_message_input')
                .setLabel(this.t('verification.settings.setverificationsystemmessage.pretty_name'))
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(
                    this.t('verification.settings.setverificationsystemmessage.placeholder', { variables: '{{key}}: user, user_id, guild, minimum_age' }))
                .setValue(verification_system!.message || '')
                .setRequired(true)
                .setMaxLength(1000),
        );

        if (interaction.isModalSubmit()) {
            const message = interaction.fields.getTextInputValue('verification_system_message_input');
            verification_system!.message = message;
            verification_system!.latest_action_from_user = user;
            verification_system!.timestamp = new Date();
            await this.db.save(VerificationSystem, verification_system!);
            await this.settingsUI(interaction);
            this.log.send('debug', 'command.setting.modalsubmit.success', {
                name: this.name,
                guild: interaction.guild,
            });
            return;
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('settings:verification:setverificationsystemmessage')
                .setTitle(this.t('verification.settings.setverificationsystemmessage.pretty_name'))
                .addComponents([message_input]),
        );
    }

    @SettingGenericSettingComponent({
        database: VerificationSystem,
        database_key: 'minimum_days',
        format_specifier: '%s',
    })
    public async setVerificationMinimumAge(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const verification_system = await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const verifications = await this.db.find(Verification, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const minimum_age_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('minimum_age_input')
                .setLabel(this.t('verification.settings.setverificationminimumage.display_name'))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(this.t('verification.settings.setverificationminimumage.placeholder'))
                .setRequired(true)
                .setValue(verification_system!.minimum_days.toString())
                .setMaxLength(8),
        );

        if (interaction.isModalSubmit()) {
            const new_age = parseInt(interaction.fields.getTextInputValue('minimum_age_input'));
            if (isNaN(new_age) || new_age < 0) {
                this.warning = this.t('verification.settings.setverificationminimumage.invalid_age', { age: new_age });
                await this.settingsUI(interaction);
                return;
            }

            for (const verification of verifications) {
                const remaining_time = verification.user_created_at.getTime() + new_age * 86400000;
                verification.remaining_time = new Date(remaining_time);
                await this.db.save(Verification, verification);
            }
            verification_system!.minimum_days = new_age;
            verification_system!.latest_action_from_user = user;
            verification_system!.timestamp = new Date();
            await this.db.save(VerificationSystem, verification_system!);
            await this.settingsUI(interaction);
            this.log.send('debug', 'command.setting.modalsubmit.success', {
                name: this.name,
                guild: interaction.guild,
            });
            return;
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('settings:verification:setverificationminimumage')
                .setTitle(this.t('verification.settings.setverificationminimumage.pretty_name'))
                .addComponents([minimum_age_input]),
        );
    }
    // ================================================================ //
}
