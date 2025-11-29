import { CommandInteraction } from 'discord.js';
import timers from 'timers/promises';
import { BaseCommand } from '../../types/structure/command';

/**
 * A simple command to measure the bot's WebSocket and API latency.
 */
export default class PingCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'ping' });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * Executes the ping command.
     *
     * It replies with a "measuring" message, then waits for the WebSocket ping to be
     * available. Once measured, it edits the original reply to show the round-trip
     * latency in milliseconds.
     *
     * @param interaction The command interaction.
     */
    public async execute(interaction: CommandInteraction): Promise<void> {
        this.log('debug', 'ping.execute.measuring_latency', {
            guild: interaction.guild,
            user: interaction.user,
        });
        const msg = await interaction.reply(
            this.t.commands({ key: 'execute.measuring', guild_id: BigInt(interaction.guildId!) }),
        );
        let ping = interaction.client.ws.ping;
        while (ping === -1) {
            ping = interaction.client.ws.ping;
            await timers.setTimeout(250);
        }
        this.log('debug', 'ping.execute.latency_measured', {
            guild: interaction.guild,
            user: interaction.user,
            ping: ping,
        });
        msg.edit(`Pong! 🏓\n${ping}ms`);
    }
    // ================================================================ //
}
