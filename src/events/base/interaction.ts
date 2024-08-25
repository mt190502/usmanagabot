import { Collection, Events, Interaction, InteractionResponse } from 'discord.js';
import { BotCommands } from '../../main';
import { Command_t } from '../../types/interface/commands';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const interactionCooldown: Collection<string, Collection<bigint, number>> = new Collection();

const exec = async (interaction: Interaction): Promise<void | InteractionResponse<boolean>> => {
    await CheckAndAddUser(null, interaction);
    await CheckAndAddChannel(null, interaction);

    if (interaction.isStringSelectMenu()) {
        if (interaction.values[0]?.includes(':')) {
            const [type, name] = interaction.values[0]?.split(':') ?? [];
            if (type == 'settings' && name == 'settings') {
                BotCommands.get(BigInt(0)).get('settings').settings(interaction);
            } else if (type == 'settings' && name !== 'settings') {
                BotCommands.get(BigInt(interaction.guild.id)).get(name).settings(interaction);
            }
        } else {
            if (interaction.values[0] == 'settings') {
                BotCommands.get(BigInt(0)).get(interaction.values[0]).execute(interaction);
            } else {
                BotCommands.get(BigInt(interaction.guild.id)).get(interaction.values[0]).execute(interaction);
            }
        }
    } else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        let command: Command_t;
        const requested_command = interaction.commandName.replaceAll(' ', '_').toLowerCase();
        if (interaction.commandGuildId === null) {
            command = BotCommands.get(BigInt(0)).get(requested_command);
        } else {
            command = BotCommands.get(BigInt(interaction.commandGuildId)).get(requested_command);
        }

        if (!command) return;
        if (!interactionCooldown.has(command.name)) interactionCooldown.set(command.name, new Collection());

        const now = Date.now();
        const timestamps = interactionCooldown.get(command.name);
        const cooldownAmount = (command.cooldown ?? 5) * 1000;

        if (timestamps.has(BigInt(interaction.user.id))) {
            const expirationTime = timestamps.get(BigInt(interaction.user.id)) + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return interaction.reply({
                    content: `Please wait ${timeLeft} second(s) before reusing the \`${command.name}\` command.`,
                    ephemeral: true,
                });
            }
        }
        timestamps.set(BigInt(interaction.user.id), now);
        setTimeout(() => timestamps.delete(BigInt(interaction.user.id)), cooldownAmount);

        try {
            await command.execute(interaction);
        } catch (error) {
            Logger('error', error);
        }
    } else if (interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
        if (interaction.customId.includes(':')) {
            const [type, name] = interaction.customId.split(':');
            if (type == 'settings' && name == 'settings') {
                BotCommands.get(BigInt(0)).get('settings').settings(interaction);
            } else if (type == 'settings' && name !== 'settings') {
                BotCommands.get(BigInt(interaction.guild.id)).get(name).settings(interaction);
            }
        } else {
            if (interaction.customId == 'settings') {
                BotCommands.get(BigInt(0)).get(interaction.customId).execute(interaction);
            } else {
                BotCommands.get(BigInt(interaction.guild.id)).get(interaction.customId).execute(interaction);
            }
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
