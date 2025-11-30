import { Events, GuildMember, RoleSelectMenuInteraction, StringSelectMenuInteraction } from 'discord.js';
import { BotClient } from '../../services/client';
import { Autorole } from '../../types/database/entities/autorole';
import { ChainEvent } from '../../types/decorator/chainevent';
import {
    SettingGenericSettingComponent,
    SettingRoleSelectMenuComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

/**
 * A pseudo-command that automatically assigns a role to new members when they join a guild.
 *
 * This command is triggered by the `GuildMemberAdd` event and is configurable through the settings system.
 * It allows administrators to enable or disable the feature and to select the specific role to be assigned.
 */
export default class AutoroleCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'autorole', is_admin_command: true });
        this.base_cmd_data = null;
    }

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log('debug', 'prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let autorole = await this.db.findOne(Autorole, { where: { from_guild: guild! } });
        if (!autorole) {
            autorole = new Autorole();
            autorole.is_enabled = false;
            autorole.from_guild = guild!;
            autorole.latest_action_from_user = system_user!;
            autorole = await this.db.save(Autorole, autorole);
            this.log('log', 'prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = autorole.is_enabled;
        this.log('debug', 'prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * Executes the autorole logic when a new member joins the guild.
     * This method is decorated with `@ChainEvent` to listen for the `GuildMemberAdd` event.
     * It checks if the feature is enabled for the guild and if a valid role is configured.
     * If so, it assigns the configured role to the new member.
     * @param member The member who just joined the guild.
     */
    @ChainEvent({ type: Events.GuildMemberAdd })
    public async execute(member: GuildMember): Promise<void> {
        this.log('debug', 'event.trigger.start', {
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
        this.log('debug', 'event.trigger.success', {
            name: 'autorole',
            event: 'GuildMemberAdd',
            guild: member.guild,
            user: member,
        });
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    /**
     * Toggles the autorole feature on or off for the guild.
     * This method is a setting component that handles a `StringSelectMenuInteraction`.
     * It updates the `is_enabled` flag in the database and refreshes the settings UI.
     * @param interaction The interaction from the settings select menu.
     */
    @SettingGenericSettingComponent({
        database: Autorole,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log('debug', 'settings.toggle.start', { name: this.name, guild: interaction.guild });
        const autorole = await this.db.findOne(Autorole, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        autorole!.is_enabled = !autorole!.is_enabled;
        autorole!.latest_action_from_user = user;
        autorole!.timestamp = new Date();
        this.enabled = autorole!.is_enabled;
        await this.db.save(Autorole, autorole!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    /**
     * Changes the role to be assigned to new members.
     * This method is a setting component that handles a `RoleSelectMenuInteraction`.
     * It validates that the selected role is below the bot's highest role in the hierarchy
     * before updating the `role_id` in the database and refreshes the settings UI.
     * @param interaction The interaction from the settings role select menu.
     */
    @SettingRoleSelectMenuComponent({
        database: Autorole,
        database_key: 'role_id',
        format_specifier: '<@&%s>',
    })
    public async changeRole(interaction: RoleSelectMenuInteraction): Promise<void> {
        this.log('debug', 'settings.role.start', { name: this.name, guild: interaction.guild });
        const autorole = await this.db.findOne(Autorole, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const server_roles = interaction.guild!.roles.cache.sort((a, b) => b.position - a.position);
        const bot_role = server_roles.find((r) => r.name === BotClient.client.user!.username)!;
        const requested_role = server_roles.get(interaction.values[0])!;

        if (requested_role.position >= bot_role.position) {
            this.warning = this.t.commands({
                key: 'settings.changerole.role_hierarchy_error',
                guild_id: BigInt(interaction.guildId!),
            });
            await this.settingsUI(interaction);
            return;
        }
        autorole!.role_id = requested_role.id;
        autorole!.latest_action_from_user = user;
        autorole!.timestamp = new Date();
        await this.db.save(Autorole, autorole!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.role.success', {
            name: this.name,
            guild: interaction.guild,
            role: autorole!.role_id,
        });
    }
    // ================================================================ //
}
