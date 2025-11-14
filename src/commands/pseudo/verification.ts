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
    GenericSetting,
    SettingChannelMenuComponent,
    SettingRoleSelectMenuComponent,
    SettingToggleButtonComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class VerificationCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'verification',
            pretty_name: 'Verification System',
            description: 'Manage the verification system for this server.',
            is_admin_command: true,
            help: `
                This command assigns a special role to users under the specified age, preventing them from accessing the server until they reach it.
            `,
        });
        this.base_cmd_data = null;
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let verification_system = await this.db.findOne(VerificationSystem, { where: { from_guild: guild! } });
        if (!verification_system) {
            verification_system = new VerificationSystem();
            verification_system.is_enabled = false;
            verification_system.from_guild = guild!;
            verification_system.latest_action_from_user = system_user!;
            verification_system = await this.db.save(VerificationSystem, verification_system);
        }
        this.enabled = verification_system.is_enabled;
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @Cron({ schedule: '* * * * *' })
    public async routineCheck(): Promise<void> {
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
    }

    public async execute(member: GuildMember): Promise<{
        message: { key: string; value: string }[];
        verification_system: VerificationSystem;
        verification: Verification;
    }> {
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
        return { message, verification_system, verification };
    }

    @ChainEvent({ type: Events.GuildMemberAdd })
    public async onMemberAdd(member: GuildMember): Promise<void> {
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
    }

    @ChainEvent({ type: Events.GuildMemberRemove })
    public async onMemberRemove(member: GuildMember): Promise<void> {
        const { verification_system, verification } = await this.execute(member);
        if (!verification_system || !verification_system.is_enabled) return;
        if (!verification.id) return;
        await this.db.delete(Verification, { id: verification.id });
        return;
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @SettingToggleButtonComponent({
        display_name: 'Enabled',
        database: VerificationSystem,
        database_key: 'is_enabled',
        pretty: 'Toggle Verification System',
        description: 'Toggle the verification system enabled/disabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        const verification_system = await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        verification_system!.is_enabled = !verification_system!.is_enabled;
        this.enabled = verification_system!.is_enabled;
        await this.db.save(VerificationSystem, verification_system!);
        await this.settingsUI(interaction);
    }

    @SettingChannelMenuComponent({
        display_name: 'Verification Target Channel',
        database: VerificationSystem,
        database_key: 'channel_id',
        pretty: 'Set Verification Target Channel',
        description: 'Set the channel where verification messages will be sent.',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
            placeholder: 'Select a channel for verification messages',
        },
    })
    public async setVerificationTargetChannel(
        interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    ): Promise<void> {
        const verification_system = (await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        }))!;
        const selected_channel = interaction.values[0];
        verification_system.channel_id = selected_channel;
        await this.db.save(VerificationSystem, verification_system);
        await this.settingsUI(interaction);
    }

    @SettingRoleSelectMenuComponent({
        display_name: 'Verification System Role',
        database: VerificationSystem,
        database_key: 'role_id',
        pretty: 'Set Verification System Role',
        description: 'Set the role that will be automatically assigned to new members requiring verification.',
        format_specifier: '<@&%s>',
        options: {
            placeholder: 'Select a role to assign for verification',
        },
    })
    public async changeVerificationRole(
        interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction,
    ): Promise<void> {
        const verification_system = await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const server_roles = interaction.guild!.roles.cache.sort((a, b) => b.position - a.position);
        const bot_role = server_roles.find((r) => r.name === BotClient.client.user!.username)!;
        const requested_role = server_roles.get(interaction.values[0])!;

        if (requested_role.position >= bot_role.position) {
            this.warning = 'The role is behind the bot role. Please select another role.';
            await this.settingsUI(interaction);
            return;
        }
        verification_system!.role_id = requested_role.id;
        await this.db.save(VerificationSystem, verification_system!);
        await this.settingsUI(interaction);
    }

    @GenericSetting({
        display_name: 'Verification System Message',
        database: VerificationSystem,
        database_key: 'message',
        pretty: 'Set Verification System Message',
        description: 'Set the message that is sent to unverified users upon joining the server.',
        format_specifier: '```\n%s\n```',
    })
    public async setVerificationSystemMessage(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    ): Promise<void> {
        const verification_system = await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const message_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('verification_system_message_input')
                .setLabel('Verification System Message')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Usable variables: {{user}}, {{user_id}}, {{guild}}, {{minimum_age}}')
                .setValue(verification_system!.message || '')
                .setRequired(true)
                .setMaxLength(1000),
        );

        if (interaction.isModalSubmit()) {
            const message = interaction.fields.getTextInputValue('verification_system_message_input');
            verification_system!.message = message;
            await this.db.save(VerificationSystem, verification_system!);
            await this.settingsUI(interaction);
            return;
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('settings:verification:setverificationsystemmessage')
                .setTitle('Set Verification System Message')
                .addComponents([message_input]),
        );
    }

    @GenericSetting({
        display_name: 'Verification Minimum Age (Days)',
        database: VerificationSystem,
        database_key: 'minimum_days',
        pretty: 'Set Verification Minimum Age',
        description: 'Set the minimum account age (in days) required to bypass verification.',
        format_specifier: '%s',
    })
    public async setVerificationMinimumAge(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    ): Promise<void> {
        const verification_system = await this.db.findOne(VerificationSystem, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const verifications = await this.db.find(Verification, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });

        const minimum_age_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('minimum_age_input')
                .setLabel('Minimum Age (Days)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the minimum age in days')
                .setRequired(true)
                .setValue(verification_system!.minimum_days.toString())
                .setMaxLength(8),
        );

        if (interaction.isModalSubmit()) {
            const new_age = parseInt(interaction.fields.getTextInputValue('minimum_age_input'));
            if (isNaN(new_age) || new_age < 0) {
                this.warning = `Invalid minimum age: \`${new_age}\`. Please enter a valid number of days.`;
                await this.settingsUI(interaction);
                return;
            }

            for (const verification of verifications) {
                const remaining_time = verification.user_created_at.getTime() + new_age * 86400000;
                verification.remaining_time = new Date(remaining_time);
                await this.db.save(Verification, verification);
            }
            verification_system!.minimum_days = new_age;
            await this.db.save(VerificationSystem, verification_system!);
            await this.settingsUI(interaction);
            return;
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('settings:verification:setverificationminimumage')
                .setTitle('Set Verification Minimum Age')
                .addComponents([minimum_age_input]),
        );
    }
    // ================================================================ //
}
