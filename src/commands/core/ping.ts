import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command_t } from '../../types/interface/commands';

const exec = async (interaction: CommandInteraction) => {
    interaction.reply(`Pong! 🏓\n${interaction.client.ws.ping}ms`);
};

const scb = (): Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> => {
    return new SlashCommandBuilder().setName('ping').setDescription('Replies Pong! with ms');
};

export default {
    enabled: true,
    name: 'ping',
    type: 'standard',
    description: 'Ping!',

    category: 'core',
    cooldown: 5,
    usage: '/ping',

    data: [scb],
    execute: exec,
} as Command_t;
