import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import timers from 'node:timers/promises';
import { Command_t } from '../../types/interface/commands';

const exec = async (interaction: CommandInteraction) => {
    const msg = await interaction.reply('Pinging...');
    let ping = interaction.client.ws.ping;
    while (ping === -1) {
        ping = interaction.client.ws.ping;
        await timers.setTimeout(250);
    }
    msg.edit(`Pong! 🏓\n${ping}ms`);
};

const scb = (): Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> => {
    return new SlashCommandBuilder().setName('ping').setDescription('Replies Pong! with ms');
};

export default {
    enabled: true,
    name: 'ping',
    pretty_name: 'Ping',
    type: 'standard',
    description: 'Ping!',

    category: 'core',
    cooldown: 5,

    data: [scb],
    execute: exec,
} as Command_t;
