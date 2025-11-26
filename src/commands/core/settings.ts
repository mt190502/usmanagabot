import {
    BaseInteraction,
    Colors,
    CommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    StringSelectMenuInteraction,
} from 'discord.js';
import { CommandLoader } from '..';
import { Paginator } from '../../utils/paginator';
import { Log } from '../../types/decorator/log';
import { BaseCommand } from '../../types/structure/command';

/**
 * A dynamic, paginated settings command for administrators.
 *
 * This command serves as the central hub for configuring all other commands that
 * are marked as `CustomizableCommand`. It dynamically generates a paginated list
 * of available commands with settings. Selecting a command from the list opens
 * its specific settings UI.
 */
export default class SettingsCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'settings', is_admin_command: true });

        this.base_cmd_data!.setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers,
        );
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * The main execution method for the settings command.
     *
     * It fetches all commands available in the current guild, filters them to find
     * those with configurable settings, and then generates the first page of a
     * paginated menu. This method can be triggered by the initial slash command or
     * by interactions from the pagination or settings components.
     *
     * @param interaction The interaction from the slash command or a component.
     */
    @Log()
    public async execute(interaction: BaseInteraction | CommandInteraction | StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.settings.execute.generating_page', {
            guild: interaction.guild,
            user: interaction.user,
        });
        const commands = [...CommandLoader.BotCommands.get(interaction.guild!.id)!.values()];
        const payload = await Paginator.generatePage(interaction.guild!.id, interaction.user.id, this.name, {
            title: `:gear: ${this.t('pretty_name', undefined, interaction)}`,
            color: Colors.Blurple,
            items: commands
                .filter((cmd) =>
                    cmd.is_bot_owner_command
                        ? interaction.guildId === this.cfg.current_botcfg.management.guild_id &&
                          interaction.user.id === this.cfg.current_botcfg.management.user_id
                        : true,
                )
                .map((cmd) => ({
                    name: cmd.name,
                    pretty_name:
                        this.t(`${cmd.name}.pretty_name`, undefined, interaction) ||
                        this.t(`${cmd.name}.name`, undefined, interaction) ||
                        cmd.pretty_name ||
                        cmd.name,
                    description:
                        this.t(`${cmd.name}.description`, undefined, interaction) || cmd.description || '<missing>',
                    namespace: 'settings' as const,
                }))
                .sort((a, b) => a.pretty_name.localeCompare(b.pretty_name)),
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
            return;
        }
    }
    // ================================================================ //
}
