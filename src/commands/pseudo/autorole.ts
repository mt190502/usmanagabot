import {
    ActionRowBuilder,
    Events,
    GuildMember,
    RoleSelectMenuBuilder,
    RoleSelectMenuInteraction,
    StringSelectMenuInteraction,
} from 'discord.js';
import { BotClient } from '../../services/client';
import { Autorole } from '../../types/database/entities/autorole';
import { ChainEvent } from '../../types/decorator/chainevent';
import { CommandSetting } from '../../types/decorator/command';
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
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let autorole = await this.db.findOne(Autorole, { where: { from_guild: guild! } });
        if (!autorole) {
            autorole = new Autorole();
            autorole.is_enabled = false;
            autorole.from_guild = guild!;
            autorole.latest_action_from_user = system_user!;
            autorole = await this.db.save(Autorole, autorole);
        }
        this.enabled = autorole.is_enabled;
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @ChainEvent({ type: Events.GuildMemberAdd })
    public async execute(member: GuildMember): Promise<void> {
        const autorole = await this.db.findOne(Autorole, {
            where: { from_guild: { gid: BigInt(member.guild.id) } },
        });
        if (!autorole || !autorole.is_enabled) return;

        const role = member.guild.roles.cache.get(autorole.role_id.toString());
        if (!role) return;

        await member.roles.add(role);
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @CommandSetting({
        display_name: 'Enabled',
        database: Autorole,
        database_key: 'is_enabled',
        pretty: 'Toggle Autorole System',
        description: 'Toggle the autorole system enabled/disabled.',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        const autorole = await this.db.findOne(Autorole, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        autorole!.is_enabled = !autorole!.is_enabled;
        this.enabled = autorole!.is_enabled;
        await this.db.save(Autorole, autorole!);
        await this.settingsUI(interaction);
    }

    @CommandSetting({
        display_name: 'Role to Assign',
        database: Autorole,
        database_key: 'role_id',
        pretty: 'Set Role to Assign',
        description: 'Set the role that will be automatically assigned to new members.',
        format_specifier: '<@&%s>',
    })
    public async changeRole(interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction): Promise<void> {
        const autorole = await this.db.findOne(Autorole, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const role_select = new RoleSelectMenuBuilder()
            .setCustomId('settings:autorole:changerole')
            .setPlaceholder('Select a role to assign to new members');

        if (interaction.isRoleSelectMenu()) {
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
        }
        if (interaction.isStringSelectMenu()) {
            await interaction.update({
                components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(role_select).toJSON()],
            });
        }
    }
    // ================================================================ //
}
