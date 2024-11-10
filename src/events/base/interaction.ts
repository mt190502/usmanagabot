import { Collection, Events, Interaction, InteractionResponse } from 'discord.js';
import { BotCommands } from '../../main';
import { Command_t } from '../../types/interface/commands';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const cooldowns: Collection<string, Collection<bigint, number>> = new Collection();

const exec = async (interaction: Interaction): Promise<void | InteractionResponse<boolean>> => {
    await CheckAndAddUser(interaction.user, null);
    await CheckAndAddChannel(interaction.channel, null);

    if (interaction.isStringSelectMenu()) {
        const [type, name] = interaction.values[0].split(':');
        let command;
        if (type == 'settings') {
            command = BotCommands.get(BigInt(interaction.guild.id)).get(name) ?? BotCommands.get(BigInt(0)).get(name);
            if (command) command.settings(interaction);
            else if (name == undefined) BotCommands.get(BigInt(0)).get('settings').execute(interaction);
            else Logger('error', `Command **${name}** not found`, interaction);
        } else if (type == 'execute') {
            command = BotCommands.get(BigInt(interaction.guild.id)).get(name) ?? BotCommands.get(BigInt(0)).get(name);
            if (command) command.execute(interaction);
            else Logger('error', `Command **${name}** not found`, interaction);
        }
    } else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        let command: Command_t;
        const requested_command = interaction.commandName.replaceAll(' ', '_').toLowerCase();
        const guild_id = interaction.commandGuildId ? BigInt(interaction.commandGuildId) : BigInt(0);
        command = BotCommands.get(guild_id).get(requested_command);
        if (!command) {
            for (const c of BotCommands.get(guild_id)) {
                if (c[1].aliases?.includes(requested_command)) {
                    command = c[1];
                    break;
                }
            }
        }

        if (!command) return;
        if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Collection());

        const now = Date.now();
        const timestamps = cooldowns.get(command.name);
        const cooldown_amount = (command.cooldown ?? 5) * 1000;

        if (timestamps.has(BigInt(interaction.user.id))) {
            const expiration_time = timestamps.get(BigInt(interaction.user.id)) + cooldown_amount;

            if (now < expiration_time) {
                const time_left = (expiration_time - now) / 1000;
                return interaction.reply({
                    content: `Please wait ${time_left.toFixed()} second(s) before reusing the \`${command.name}\` command.`,
                    ephemeral: true,
                });
            }
        }
        timestamps.set(BigInt(interaction.user.id), now);
        setTimeout(() => timestamps.delete(BigInt(interaction.user.id)), cooldown_amount);

        await command.execute(interaction);
    } else if (interaction.isModalSubmit() || interaction.isAnySelectMenu() || interaction.isButton()) {
        const [type, name] = interaction.customId.split(':');
        let command;

        if (type == 'settings') {
            command = BotCommands.get(BigInt(interaction.guild.id)).get(name) ?? BotCommands.get(BigInt(0)).get(name);
            if (command) command.settings(interaction);
            else if (name == undefined) BotCommands.get(BigInt(0)).get('settings').settings(interaction);
            else Logger('error', `Command **${name}** not found`, interaction);
        } else if (type == 'execute') {
            command = BotCommands.get(BigInt(interaction.guild.id)).get(name) ?? BotCommands.get(BigInt(0)).get(name);
            if (command) command.execute(interaction);
            else Logger('error', `Command **${name}** not found`, interaction);
        }
    } else {
        console.log('Unknown');
    }
};

export default {
    enabled: true,
    once: false,
    name: 'interactionCreate',
    data: Events.InteractionCreate,
    execute: exec,
} as Event_t;
