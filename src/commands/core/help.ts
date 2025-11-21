import { ButtonInteraction, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { CommandLoader } from '..';
import { HandleAction } from '../../types/decorator/command';
import { BaseCommand } from '../../types/structure/command';

export default class HelpCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'help', cooldown: 5 });
    }
    // ================================================================ //

    // ============================ EXECUTE =========================== //
    public async execute(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
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
        const commands = Array.from([
            ...(CommandLoader.BotCommands.get(interaction.guild!.id)?.entries() || []),
            ...(CommandLoader.BotCommands.get('global')?.entries() || []),
        ])
            .filter(([, cmd]) => cmd.enabled)
            .filter(([, cmd]) => (cmd.is_admin_command ? user_is_admin : true))
            .filter(([, cmd]) => !cmd.help?.includes('missing'))
            .filter(([, cmd]) =>
                cmd.is_bot_owner_command
                    ? interaction.guildId === this.cfg.current_botcfg.management.guild_id &&
                      interaction.user.id === this.cfg.current_botcfg.management.user_id
                    : true,
            )
            .sort((a, b) => a[1].pretty_name.localeCompare(b[1].pretty_name));
        const payload = await this.paginator.generatePage(interaction.guild!.id, interaction.user.id, this.name, {
            title: `:information_source: ${this.t('help.execute.main_title')}`,
            color: 0x00ffff,
            items: commands.map(([, cmd]) => ({
                name: cmd.name,
                pretty_name: cmd.pretty_name || cmd.name,
                description: cmd.description || '<missing>',
                namespace: 'command' as const,
            })),
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
        this.log.send('debug', 'command.execute.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
    }

    @HandleAction('pageitem')
    public async handlePageItem(interaction: ButtonInteraction, item_name: string): Promise<void> {
        this.log.send('debug', 'command.handlePageItem.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        const command = [
            ...(CommandLoader.BotCommands.get(interaction.guild!.id)?.entries() || []),
            ...(CommandLoader.BotCommands.get('global')?.entries() || []),
        ].find(([, cmd]) => cmd.name === item_name)![1];
        const payload = await this.paginator.viewPage(interaction.guild!.id, interaction.user.id, this.name, {
            title: `:information_source: ${this.t('help.execute.command_title', { command: command.pretty_name })}`,
            color: 0x00ffff,
            description: command.help || '<missing>',
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
