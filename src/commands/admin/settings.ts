import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { BotCommands } from '../../main';
import { Command_t } from '../../types/interface/commands';

const exec = async (interaction: ChatInputCommandInteraction | StringSelectMenuInteraction): Promise<void> => {
    const guildID = BigInt(interaction.guild.id);

    await (
        interaction.type === 2
            ? (interaction as ChatInputCommandInteraction).reply.bind(interaction)
            : (interaction as StringSelectMenuInteraction).update.bind(interaction)
    )({
        ephemeral: true,
        content: 'Select a setting',
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder().setCustomId('settings').addOptions(
                        BotCommands.get(guildID)
                            .filter((command) => command.settings)
                            .map((command) => ({
                                label: command.name[0].toUpperCase() + command.name.slice(1),
                                description: command.description,
                                value: `settings:${command.name}`,
                            }))
                    )
                )
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
    type: 'standard',
    description: 'Change bot settings',

    category: 'utils',
    cooldown: 5,
    usage: '/settings',

    data: scb,
    execute: exec,
} as Command_t;
