import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { BotCommands } from '../../main';
import { Command_t } from '../../types/interface/commands';

const exec = async (interaction: ChatInputCommandInteraction | StringSelectMenuInteraction): Promise<void> => {
    const guild_id = BigInt(interaction.guild.id);
    const settings = BotCommands.get(guild_id)
        .filter((command) => command.settings)
        .map((command) => ({
            label: command.name
                .split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
            description: command.description,
            value: `settings:${command.name}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const genPostEmbed = (): EmbedBuilder => {
        return new EmbedBuilder()
            .setTitle(':gear: Settings')
            .setColor(Colors.Blurple)
            .setDescription(
                '**__Configurable Plugins__**\n' +
                    settings.map((setting) => `**${setting.label}** - ${setting.description}`).join('\n')
            );
    };

    await (
        interaction.type === 2
            ? (interaction as ChatInputCommandInteraction).reply.bind(interaction)
            : (interaction as StringSelectMenuInteraction).update.bind(interaction)
    )({
        flags: MessageFlags.Ephemeral,
        embeds: [genPostEmbed()],
        components: [
            new ActionRowBuilder()
                .addComponents(new StringSelectMenuBuilder().addOptions(settings).setCustomId('settings:0'))
                .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
        ],
    });
};

const scb = async (): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    return new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Change bot settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers);
};

export default {
    enabled: true,
    name: 'settings',
    pretty_name: 'Settings',
    type: 'standard',
    description: 'Change bot settings',

    category: 'admin',
    cooldown: 5,

    data: [scb],
    execute: exec,
} as Command_t;
