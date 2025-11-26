import { ButtonInteraction, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { CommandLoader } from '..';
import { HandleAction } from '../../types/decorator/command';
import { Log } from '../../types/decorator/log';
import { BaseCommand } from '../../types/structure/command';
import { Paginator } from '../../utils/paginator';

/**
 * A dynamic, paginated help command.
 *
 * This command displays a list of all available and accessible commands to the user.
 * The command list is filtered based on user permissions (regular vs. admin) and
 * whether a command is marked as bot-owner-only. The list is presented in a
 * paginated embed, allowing the user to browse through commands. Clicking a
 * command button shows its detailed help information.
 */
export default class HelpCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'help', cooldown: 5 });
    }
    // ================================================================ //

    // ============================ EXECUTE =========================== //
    /**
     * The main execution method for the help command.
     *
     * It filters the global list of commands based on the user's permissions and
     * generates the first page of the paginated help menu. It can be triggered
     * by the initial slash command or by pagination buttons.
     *
     * @param interaction The interaction from the slash command or a button press.
     */
    @Log()
    public async execute(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
        this.log.send('debug', 'command.help.execute.generating_page', {
            guild: interaction.guild,
            user: interaction.user,
        });
        const user_is_admin =
            interaction
                .guild!.members.cache.get(interaction.user.id)
                ?.permissions.has(
                    PermissionFlagsBits.Administrator |
                        PermissionFlagsBits.ManageGuild |
                        PermissionFlagsBits.ManageMessages,
                ) || false;
        const commands = [
            ...CommandLoader.BotCommands.get(interaction.guildId!)!.values(),
            ...CommandLoader.BotCommands.get('global')!.values(),
        ]
            .filter((cmd) => cmd.enabled)
            .filter((cmd) => (cmd.is_admin_command ? user_is_admin : true))
            .filter((cmd) => !cmd.help?.includes('missing'))
            .filter((cmd) =>
                cmd.is_bot_owner_command
                    ? interaction.guildId === this.cfg.current_botcfg.management.guild_id &&
                      interaction.user.id === this.cfg.current_botcfg.management.user_id
                    : true,
            );
        const payload = await Paginator.generatePage(interaction.guild!.id, interaction.user.id, this.name, {
            title: `:information_source: ${this.t('execute.main_title', undefined, interaction)}`,
            color: 0x00ffff,
            items: commands
                .map((cmd) => ({
                    name: cmd.name,
                    pretty_name:
                        this.t(`${cmd.name}.pretty_name`, undefined, interaction) ||
                        this.t(`${cmd.name}.name`, undefined, interaction) ||
                        cmd.pretty_name ||
                        cmd.name,
                    description:
                        this.t(`${cmd.name}.description`, undefined, interaction) || cmd.description || '<missing>',
                    namespace: 'command' as const,
                }))
                .sort((a, b) => a.pretty_name.localeCompare(b.pretty_name)),
            items_per_page: 5,
        });
        this.log.send('debug', 'command.help.execute.commands_filtered', {
            length: commands.length,
            guild: interaction.guild,
            user: interaction.user,
        });
        if (interaction.isButton()) {
            await interaction.update({
                embeds: payload.embeds,
                components: payload.components,
            });
            return;
        }
        await interaction.reply({
            embeds: payload.embeds,
            components: payload.components,
            flags: MessageFlags.Ephemeral,
        });
    }

    /**
     * Handles the button press for a specific command in the help menu.
     *
     * When a user clicks a command's button on a help page, this method is invoked.
     * It finds the detailed help text for the selected command and displays it in a
     * new "view page" provided by the Paginator, which includes a "Back" button.
     *
     * @param interaction The button interaction from the help page.
     * @param item_name The name of the command that was clicked, passed from the button's custom ID.
     */
    @HandleAction('pageitem')
    @Log()
    public async handlePageItem(interaction: ButtonInteraction, item_name: string): Promise<void> {
        this.log.send('debug', 'command.handlePageItem.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        const command = [
            ...CommandLoader.BotCommands.get(interaction.guild!.id)!.values(),
            ...CommandLoader.BotCommands.get('global')!.values(),
        ].find((cmd) => cmd.name === item_name)!;
        const payload = await Paginator.viewPage(interaction.guild!.id, interaction.user.id, this.name, {
            title: `:information_source: ${this.t('execute.command_title', { command: this.t(`${command.name}.pretty_name`, undefined, interaction) }, interaction)}`,
            color: 0x00ffff,
            description: this.t(`${command.name}.help`, undefined, interaction) || '<missing>',
        });
        await interaction.update({
            embeds: payload.embeds,
            components: payload.components,
        });
        this.log.send('debug', 'command.handlePageItem.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
    }
    // ================================================================ //
}
