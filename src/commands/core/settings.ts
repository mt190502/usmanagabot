import {
    ActionRowBuilder,
    Colors,
    CommandInteraction,
    EmbedBuilder,
    Interaction,
    MessageFlags,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
} from 'discord.js';
import { CommandLoader } from '..';
import { BaseCommand } from '../../types/structure/command';

export default class SettingsCommand extends BaseCommand {
    constructor() {
        super({
            name: 'settings',
            pretty_name: 'Settings',
            description: 'Manage modules and bot settings.',
            usage: '/settings',
            help: 'Use this command to manage various modules and settings of the bot.',
        });
        this.base_cmd_data.setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers,
        );
    }

    public async execute(interaction: Interaction | CommandInteraction): Promise<void> {
        if (!interaction.isCommand() || interaction.commandName !== this.name) return;

        const guild = interaction.guild!;
        const guild_commands = Array.from(CommandLoader.BotCommands.get(String(guild.id))!).map(([, cmd]) => ({
            label: cmd.pretty_name,
            description: cmd.description,
            value: `settings:${cmd.name}`,
        }));
        const settings_embed = new EmbedBuilder()
            .setTitle(':gear: Settings')
            .setColor(Colors.Blurple)
            .setDescription(
                '**__Configurable Modules & Settings:__**\n' +
                    Array.from(guild_commands)
                        .map((cmd) => `\`${cmd.label}\``)
                        .sort((a, b) => a.localeCompare(b))
                        .join(' • '),
            );
        const settings_actionrow = new ActionRowBuilder()
            .addComponents(new StringSelectMenuBuilder().addOptions(guild_commands).setCustomId('settings'))
            .toJSON();

        await interaction.reply.bind(interaction)({
            flags: MessageFlags.Ephemeral,
            embeds: [settings_embed],
            components: [settings_actionrow],
        });
    }
}
