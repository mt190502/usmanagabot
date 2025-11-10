import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { CommandLoader } from '..';
import { HandleAction } from '../../types/decorator/command';
import { BaseCommand } from '../../types/structure/command';

export default class HelpCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    private page: Map<string, Map<string, number>> = new Map();

    constructor() {
        super({
            name: 'help',
            pretty_name: 'Help',
            description: 'Provides information about available commands and how to use them.',
            help: `
                Provides information about available commands and how to use them.

                **Usage:**
                - \`/help\` - Lists all available commands.
            `,
            cooldown: 5,
        });
    }
    // ================================================================ //

    // ============================ EXECUTE =========================== //
    public async execute(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
        const payload = await this.buildHelpPage(interaction.user.id, interaction.guild!.id, interaction);
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

    private async buildHelpPage(
        user_id: string,
        guild_id: string,
        interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
        command_name?: string,
    ): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] }> {
        const commands: { name: string; pretty_name: string; description: string; help: string }[] = [];
        for (const command of [
            ...(CommandLoader.BotCommands.get(guild_id)?.entries() || []),
            ...(CommandLoader.BotCommands.get('global')?.entries() || []),
        ].sort((a, b) => a[1].pretty_name?.localeCompare(b[1].pretty_name || b[0]) || a[0].localeCompare(b[0]))) {
            if (!command) continue;
            for (const [name, cmd] of [command]) {
                if (!cmd.enabled) continue;
                if (cmd.is_admin_command) {
                    const member = interaction.guild?.members.cache.get(user_id);
                    if (!member?.permissions.has(PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild)) {
                        continue;
                    }
                }
                commands.push({
                    name: name,
                    pretty_name: cmd.pretty_name || name,
                    description: cmd.description || 'Not provided.',
                    help: cmd.help.replaceAll(/^[ ]{16}/gm, '').trim() || 'No help available for this command.',
                });
            }
        }
        const user_pages = this.page.get(guild_id) || new Map<string, number>();
        if (!this.page.has(guild_id)) this.page.set(guild_id, user_pages);
        if (!user_pages.has(user_id)) user_pages.set(user_id, 1);
        const current_page = user_pages.get(user_id)!;

        const ui = new EmbedBuilder().setColor(0x00ffff);
        const string_select_menu = new StringSelectMenuBuilder()
            .setCustomId('command:help:request')
            .setPlaceholder('Select a command to view detailed help');
        const button_row = new ActionRowBuilder<ButtonBuilder>();
        const previous = new ButtonBuilder()
            .setCustomId('command:help:prevpage')
            .setLabel('Previous Page')
            .setStyle(ButtonStyle.Primary);
        const next = new ButtonBuilder()
            .setCustomId('command:help:nextpage')
            .setLabel('Next Page')
            .setStyle(ButtonStyle.Primary);
        const back = new ButtonBuilder().setCustomId('command:help').setLabel('Back').setStyle(ButtonStyle.Secondary);

        if (command_name) {
            const command = commands.find((cmd) => cmd.name === command_name)!;
            ui.setTitle(command.pretty_name);
            ui.setDescription(command.help.replaceAll(/^[ ]{16}/gm, '').trim());
            button_row.addComponents(back);
            return {
                embeds: [ui],
                components: [button_row],
            };
        } else {
            ui.setTitle(`List of Available Commands (${current_page}/${Math.ceil(commands.length / 5)})`);
            let description = '';
            previous.setDisabled(current_page === 1);
            next.setDisabled(current_page * 5 >= commands.length);
            button_row.addComponents(previous, next);
            const page = commands.slice((current_page - 1) * 5, current_page * 5);
            for (const cmd of page) {
                description += `**${cmd.pretty_name}**\n${cmd.description}\n\n`;
                string_select_menu.addOptions({
                    label: cmd.pretty_name,
                    description: cmd.description,
                    value: `command:help:request:${cmd.name}`,
                });
            }
            ui.setDescription(description.trim());
            return {
                embeds: [ui],
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(string_select_menu),
                    button_row,
                ],
            };
        }
    }

    @HandleAction('prevpage')
    @HandleAction('nextpage')
    private async pagination(interaction: ButtonInteraction) {
        if (!interaction.isButton()) return;
        let current = this.page.get(interaction.guild!.id)?.get(interaction.user.id);
        if (!current) {
            current = 1;
            this.page.get(interaction.guild!.id)?.set(interaction.user.id, current);
        }
        if (interaction.customId === 'command:help:prevpage') {
            current--;
            this.page.get(interaction.guild!.id)?.set(interaction.user.id, current);
        } else if (interaction.customId === 'command:help:nextpage') {
            current++;
            this.page.get(interaction.guild!.id)?.set(interaction.user.id, current);
        }
        const payload = await this.buildHelpPage(interaction.user.id, interaction.guild!.id, interaction);
        await interaction.update({
            embeds: payload.embeds,
            components: payload.components,
        });
    }

    @HandleAction('request')
    private async getCommandHelp(interaction: StringSelectMenuInteraction, command_name: string) {
        if (!interaction.isStringSelectMenu()) return;
        const payload = await this.buildHelpPage(interaction.user.id, interaction.guild!.id, interaction, command_name);
        await interaction.update({
            embeds: payload.embeds,
            components: payload.components,
        });
    }
    // ================================================================ //
}
