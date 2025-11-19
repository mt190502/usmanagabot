import { CommandInteraction } from 'discord.js';
import timers from 'timers/promises';
import { BaseCommand } from '../../types/structure/command';

export default class PingCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'ping',
            pretty_name: 'Ping',
            description: 'Replies with Pong! and the bot latency.',
            help: `
                Use this command to check the bot's latency to the Discord servers. The bot will respond with "Pong!" along with the current latency in milliseconds.

                Example Command:
                \`/ping\`

                Response:
                \`\`\`plain
                Pong! 🏓
                123ms
                \`\`\`
            `,
        });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    public async execute(interaction: CommandInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        this.log.send('debug', 'command.ping.execute.measuring_latency', {
            guild: interaction.guild,
            user: interaction.user,
        });
        const msg = await interaction.reply('Pinging...');
        let ping = interaction.client.ws.ping;
        while (ping === -1) {
            ping = interaction.client.ws.ping;
            await timers.setTimeout(250);
        }
        this.log.send('debug', 'command.ping.execute.latency_measured', {
            guild: interaction.guild,
            user: interaction.user,
            ping: ping,
        });
        msg.edit(`Pong! 🏓\n${ping}ms`);
        this.log.send('debug', 'command.execute.success', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
    }
    // ================================================================ //
}
