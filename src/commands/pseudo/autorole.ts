import { Events, GuildMember, RoleSelectMenuInteraction, StringSelectMenuInteraction } from 'discord.js';
import { BotClient } from '../../services/client';
import { Autorole } from '../../types/database/entities/autorole';
import { ChainEvent } from '../../types/decorator/chainevent';
import {
    SettingGenericSettingComponent,
    SettingRoleSelectMenuComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class AutoroleCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'autorole', is_admin_command: true });
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
    @SettingGenericSettingComponent({
        database: Autorole,
        database_key: 'is_enabled',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
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
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    @SettingRoleSelectMenuComponent({
        database: Autorole,
        database_key: 'role_id',
        format_specifier: '<@&%s>',
    })
    public async changeRole(interaction: RoleSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.role.start', { name: this.name, guild: interaction.guild });
        const autorole = await this.db.findOne(Autorole, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const server_roles = interaction.guild!.roles.cache.sort((a, b) => b.position - a.position);
        const bot_role = server_roles.find((r) => r.name === BotClient.client.user!.username)!;
        const requested_role = server_roles.get(interaction.values[0])!;

        if (requested_role.position >= bot_role.position) {
            this.warning = this.t('autorole.settings.changerole.role_hierarchy_error');
            await this.settingsUI(interaction);
            return;
        }
        autorole!.role_id = requested_role.id;
        autorole!.latest_action_from_user = user;
        autorole!.timestamp = new Date();
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
