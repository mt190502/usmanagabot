import { CommandInteraction } from 'discord.js';
import timers from 'timers/promises';
import { BaseCommand } from '../../types/structure/command';

export default class PingCommand extends BaseCommand {
    constructor() {
        super({
            name: 'ping',
            pretty_name: 'Ping',
            description: 'Replies with Pong! and the bot latency.',
            usage: '/ping',
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

    public async execute(interaction: CommandInteraction): Promise<void> {
        const msg = await interaction.reply('Pinging...');
        let ping = interaction.client.ws.ping;
        while (ping === -1) {
            ping = interaction.client.ws.ping;
            await timers.setTimeout(250);
        }
        msg.edit(`Pong! 🏓\n${ping}ms`);
    }
}
