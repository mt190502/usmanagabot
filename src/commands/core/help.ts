import {
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { BotClient, BotCommands } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Command_t } from '../../types/interface/commands';

const standard_commands = BotCommands.get(BigInt(0));

const exec = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const customizable_commands = BotCommands.get(BigInt(interaction.guild.id)).filter(
        (command) => command.category != 'pseudo'
    );

    let commands = [...standard_commands, ...customizable_commands].sort();
    if (interaction.commandName == 'mod_help') {
        commands = commands.filter(([, c]) => c.category == 'admin');
    } else {
        commands = commands.filter(([, c]) => c.category != 'admin');
    }
    const post = new EmbedBuilder();

    const bot_commands_on_dc = await BotClient.application.commands.fetch();
    const guild_commands_on_dc = await interaction.guild.commands.fetch();

    if (!interaction.options.getString('command')) {
        post.setTitle(':information: List of commands');
        post.setColor(Colors.Blue);
        let message: string = '';
        for (const [, command] of commands) {
            message += `**${command.pretty_name}** - ${command.description}\n`;
        }
        post.setDescription(message);
        await interaction.reply({ embeds: [post], ephemeral: true });
        return;
    } else {
        const [, command] = commands.find(([, c]) => c.name == interaction.options.getString('command'));
        if (command) {
            const command_id =
                command.type == 'customizable'
                    ? guild_commands_on_dc.find((c) => command.name == c.name && c.type != 3).id
                    : bot_commands_on_dc.find((c) => command.name == c.name && c.type != 3).id;
            post.setTitle(`:information: ${command.pretty_name}`);
            post.setColor(Colors.Blue);
            let message = '';
            message += `**Description:** ${command.description}\n`;
            message += `**Usage:** </${command.name}:${command_id}> ` + (command.parameters ??= '') + '\n';
            message += `**Cooldown:** ${command.cooldown} seconds\n`;
            post.setDescription(message);
            await interaction.reply({ embeds: [post], ephemeral: true });
            return;
        }
    }
};

const modscb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const customizable_commands = BotCommands.get(BigInt(guild.gid.toString())).filter(
        (command) => command.category != 'pseudo'
    );
    const data = new SlashCommandBuilder()
        .setName('mod_help')
        .setDescription('Get help with commands (Moderators only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers);
    const choices: { name: string; value: string }[] = [];
    for (const [command_name, command_data] of [...standard_commands, ...customizable_commands]
        .sort()
        .filter(([, c]) => c.category == 'admin')) {
        choices.push({ name: command_data.pretty_name, value: command_name });
    }
    data.addStringOption((option) =>
        option.setName('command').setDescription('Command name').setRequired(false).setChoices(choices)
    );
    return data;
};

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const customizable_commands = BotCommands.get(BigInt(guild.gid.toString())).filter(
        (command) => command.category != 'pseudo'
    );
    const data = new SlashCommandBuilder().setName('help').setDescription('Get help with commands');
    const choices: { name: string; value: string }[] = [];
    for (const [command_name, command_data] of [...standard_commands, ...customizable_commands]
        .sort()
        .filter(([, c]) => c.category != 'admin')) {
        choices.push({ name: command_data.pretty_name, value: command_name });
    }
    data.addStringOption((option) =>
        option.setName('command').setDescription('Command name').setRequired(false).setChoices(choices)
    );
    return data;
};

export default {
    enabled: true,
    name: 'help',
    pretty_name: 'Help',
    type: 'customizable',
    description: 'Get help with commands',
    load_after_ready: true,

    aliases: ['mod_help'],
    category: 'utils',
    cooldown: 5,

    data: [scb, modscb],
    execute: exec,
} as Command_t;
