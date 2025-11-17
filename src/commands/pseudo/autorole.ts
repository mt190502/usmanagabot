import { Events, GuildMember, RoleSelectMenuInteraction, StringSelectMenuInteraction } from 'discord.js';
import { BotClient } from '../../services/client';
import { Autorole } from '../../types/database/entities/autorole';
import { ChainEvent } from '../../types/decorator/chainevent';
import { SettingRoleSelectMenuComponent, SettingToggleButtonComponent } from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class AutoroleCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'autorole',
            pretty_name: 'AutoRole',
            description: 'Manage automatic role assignments for new members',
            cooldown: 10,
            is_admin_command: true,
            help: `
                Use this command to manage automatic role assignments for new members joining the server.

                **Usage:**
                - \`No Usage\`
            `,
        });
        this.base_cmd_data = null;
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let autorole = await this.db.findOne(Autorole, { where: { from_guild: guild! } });
        if (!autorole) {
            autorole = new Autorole();
            autorole.is_enabled = false;
            autorole.from_guild = guild!;
            autorole.latest_action_from_user = system_user!;
            autorole = await this.db.save(Autorole, autorole);
            this.log.send('log', 'command.prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = autorole.is_enabled;
        this.log.send('debug', 'command.prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @ChainEvent({ type: Events.GuildMemberAdd })
    public async execute(member: GuildMember): Promise<void> {
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'autorole',
            event: 'GuildMemberAdd',
            guild: member.guild,
            user: member,
        });
        const autorole = await this.db.findOne(Autorole, {
            where: { from_guild: { gid: BigInt(member.guild.id) } },
        });
        if (!autorole || !autorole.is_enabled) return;

        const role = member.guild.roles.cache.get(autorole.role_id.toString());
        if (!role) return;

        await member.roles.add(role);
        this.log.send('debug', 'command.event.trigger.success', {
            name: 'autorole',
            event: 'GuildMemberAdd',
            guild: member.guild,
            user: member,
        });
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @SettingToggleButtonComponent({
        display_name: 'Enabled',
        database: Autorole,
        database_key: 'is_enabled',
        pretty: 'Toggle Autorole System',
        description: 'Toggle the autorole system enabled/disabled.',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
        const autorole = await this.db.findOne(Autorole, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        autorole!.is_enabled = !autorole!.is_enabled;
        this.enabled = autorole!.is_enabled;
        await this.db.save(Autorole, autorole!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    @SettingRoleSelectMenuComponent({
        display_name: 'Role to Assign',
        database: Autorole,
        database_key: 'role_id',
        pretty: 'Set Role to Assign',
        description: 'Set the role that will be automatically assigned to new members.',
        format_specifier: '<@&%s>',
        options: {
            placeholder: 'Select a role to assign to new members',
        },
    })
    public async changeRole(interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.role.start', { name: this.name, guild: interaction.guild });
        const autorole = await this.db.findOne(Autorole, {
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
        autorole!.role_id = requested_role.id;
        await this.db.save(Autorole, autorole!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.role.success', {
            name: this.name,
            guild: interaction.guild,
            role: autorole!.role_id,
        });
    }
    // ================================================================ //
}
