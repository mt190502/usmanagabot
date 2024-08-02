import { Collection, Events, Interaction, InteractionResponse } from 'discord.js';
import { BotCommands } from '../../main';
import { Command_t } from '../../types/interface/commands';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddChannel, CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const interactionCooldown: Collection<string, Collection<number, number>> = new Collection();

const exec = async (interaction: Interaction): Promise<void | InteractionResponse<boolean>> => {
    switch (true) {
        case interaction.isAnySelectMenu():
            if (interaction.values[0] === 'settings') BotCommands.get(0).get('settings').execute(interaction);
            else BotCommands.get(Number(interaction.guild.id)).get(interaction.values[0].split(':')[1]).settings(interaction);
            break;
        case interaction.isChannelSelectMenu():
            console.log('ChannelSelectMenu');
            break;
        case interaction.isChatInputCommand():
            let command: Command_t;
            if (interaction.commandGuildId === null) {
                command = BotCommands.get(0).get(interaction.commandName);
            } else {
                command = BotCommands.get(Number(interaction.commandGuildId)).get(interaction.commandName);
            }

            if (!command) return;
            if (!interactionCooldown.has(command.name)) interactionCooldown.set(command.name, new Collection());

            const now = Date.now();
            const timestamps = interactionCooldown.get(command.name);
            const cooldownAmount = (command.cooldown ?? 5) * 1000;

            if (timestamps.has(Number(interaction.user.id))) {
                const expirationTime = timestamps.get(Number(interaction.user.id)) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return interaction.reply({
                        content: `Please wait ${timeLeft} second(s) before reusing the \`${command.name}\` command.`,
                        ephemeral: true,
                    });
                }
            }
            timestamps.set(Number(interaction.user.id), now);
            setTimeout(() => timestamps.delete(Number(interaction.user.id)), cooldownAmount);

            try {
                await command.execute(interaction);
            } catch (error) {
                Logger('error', error);
            }
            break;
        case interaction.isCommand():
            console.log('Command');
            break;
        case interaction.isContextMenuCommand():
            console.log('ContextMenu');
            break;
        case interaction.isMentionableSelectMenu():
            console.log('MentionableSelectMenu');
            break;
        case interaction.isMessageComponent():
            console.log('MessageComponent');
            break;
        case interaction.isRepliable():
            if (interaction.customId === 'settings') BotCommands.get(0).get('settings').execute(interaction);
            else BotCommands.get(Number(interaction.guild.id)).get(interaction.customId.split(':')[1]).settings(interaction);
            break;
        case interaction.isRoleSelectMenu():
            console.log('RoleSelectMenu');
            break;
        case interaction.isStringSelectMenu():
            console.log('StringSelectMenu');
            break;
        case interaction.isUserContextMenuCommand():
            console.log('UserContextMenu');
            break
        case interaction.isUserSelectMenu():
            console.log('UserSelectMenu');
            break;
        default:
            console.log('Unknown');
            break;
    }
    await CheckAndAddUser(null, interaction);
    await CheckAndAddChannel(null, interaction);
}

export default {
    enabled: true,
    once: false,
    name: 'interactionCreate',
    data: Events.InteractionCreate,
    execute: exec,
} as Event_t;
