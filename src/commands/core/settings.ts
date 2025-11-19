import {
    Colors,
    CommandInteraction,
    Interaction,
    MessageFlags,
    PermissionFlagsBits,
    StringSelectMenuInteraction,
} from 'discord.js';
import { CommandLoader } from '..';
import { BaseCommand } from '../../types/structure/command';

export default class SettingsCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'settings',
            pretty_name: 'Settings',
            description: 'Manage modules and bot settings.',
            is_admin_command: true,
            help: 'Use this command to manage various modules and settings of the bot.',
        });
        this.base_cmd_data!.setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers,
        );
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    public async execute(interaction: Interaction | CommandInteraction | StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        this.log.send('debug', 'command.settings.execute.generating_page', {
            guild: interaction.guild,
            user: interaction.user,
        });
        const commands = Array.from(CommandLoader.BotCommands.get(interaction.guild!.id)!);
        const payload = await this.paginator.generatePage(interaction.guild!.id, interaction.user.id, this.name, {
            title: ':gear: Settings - Configurable Modules & Settings',
            color: Colors.Blurple,
            items: commands
                .sort((a, b) => a[0].localeCompare(b[0]))
                .filter(([, cmd]) =>
                    cmd.is_bot_owner_command
                        ? interaction.guildId === this.cfg.current_botcfg.management.guild_id &&
                          interaction.user.id === this.cfg.current_botcfg.management.user_id
                        : true,
                )
                .map(([, cmd]) => ({
                    name: cmd.name,
                    pretty_name: cmd.pretty_name,
                    description: cmd.description,
                    namespace: 'settings' as const,
                })),
            items_per_page: 5,
        });
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            await interaction.update({
                embeds: payload.embeds,
                components: payload.components,
            });
            return;
        } else if (interaction.isCommand()) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: payload.embeds,
                components: payload.components,
            });
            this.log.send('debug', 'command.execute.success', {
                name: this.name,
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }
    }
    // ================================================================ //
}
