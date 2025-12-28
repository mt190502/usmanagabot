import { CommandLoader } from '@commands/index';
import { BaseCommand, CustomizableCommand } from '@src/types/structure/command';
import { BaseEvent } from '@src/types/structure/event';
import { RegisterFact } from '@utils/common';
import { Paginator } from '@utils/paginator';
import { BaseInteraction, Channel, Collection, CommandInteraction, Events, MessageFlags, User } from 'discord.js';

/**
 * Routes component-based interactions (buttons, select menus, modals) to the appropriate command method.
 *
 * This function parses a `customId` string, which follows the format `namespace:command_name:arg1:arg2...`,
 * to determine which action to take. It supports pagination, command execution, and settings management.
 *
 * @param {string} action The `customId` from the interaction.
 * @param {BaseInteraction | CommandInteraction} interaction The interaction object.
 * @returns {Promise<void>}
 */
const handleCommand = async (action: string, interaction: BaseInteraction | CommandInteraction): Promise<void> => {
    const [namespace, command_name, ...args] = action.split(':');
    const command =
        CommandLoader.BotCommands.get(interaction.guild!.id)?.get(command_name) ||
        CommandLoader.BotCommands.get('global')?.get(command_name);
    if (!command) return;
    const target = Reflect.getMetadata(`custom:${namespace}`, command.constructor);

    switch (namespace) {
        case 'command': {
            if (args.length === 0) {
                command.execute(interaction);
                break;
            }
            if (target!.get(args[0])) {
                target.get(args[0])?.value.apply(command, [interaction, ...args.slice(1)]);
                break;
            }
            target.get(args[0].replaceAll('_', ''))?.value.apply(command, [interaction, ...args.slice(1)]);
            break;
        }
        case 'page': {
            if (args.length >= 1) {
                let payload;

                if (args[0] === 'prev') {
                    payload = await Paginator.previousPage(interaction.guild!.id, interaction.user.id, command_name);
                } else if (args[0] === 'next') {
                    payload = await Paginator.nextPage(interaction.guild!.id, interaction.user.id, command_name);
                } else {
                    payload = await Paginator.backPage(interaction.guild!.id, interaction.user.id, command_name);
                }

                if (payload.embeds.length > 0 && interaction.isButton()) {
                    await interaction.update({
                        embeds: payload.embeds,
                        components: payload.components,
                    });
                }
            }
            break;
        }
        case 'settings': {
            if (action === 'settings') {
                command.execute(interaction);
                return;
            }
            if (command_name && args.length === 0 && command instanceof CustomizableCommand) {
                if (command.settingsUI && interaction instanceof BaseInteraction) {
                    command.settingsUI.apply(command, [interaction]);
                }
                return;
            }
            if (command_name && args.length > 0 && command instanceof CustomizableCommand) {
                if (target.get(args[0])) {
                    target.get(args[0])?.func.value.apply(command, [interaction, ...args.slice(1)]);
                    break;
                }
                target.get(args[0].replaceAll('_', ''))?.func.value.apply(command, [interaction, ...args.slice(1)]);
                break;
            }
            break;
        }
        default:
            return;
    }
};

/**
 * An in-memory collection to manage command cooldowns.
 *
 * The outer collection maps a command name to an inner collection.
 * The inner collection maps a user's ID to the timestamp of their last command usage.
 */
const cooldowns: Collection<string, Collection<bigint, number>> = new Collection();

/**
 * Handles all incoming Discord interactions, acting as the central hub for command execution,
 * component interactions, and cooldown management.
 */
export default class InteractionEvent extends BaseEvent<Events.InteractionCreate> {
    constructor() {
        super({ enabled: true, type: Events.InteractionCreate, once: false });
    }

    /**
     * The main execution method for the `interactionCreate` event.
     *
     * This method performs the following actions:
     * 1. Registers the interacting user and channel in the database.
     * 2. Determines the type of interaction (e.g., chat command, button, select menu).
     * 3. For command interactions, it identifies the correct command, enforces cooldowns, and executes it.
     * 4. For component interactions, it delegates the logic to the `handleCommand` helper function.
     *
     * @param {BaseInteraction} interaction The interaction object from Discord.js.
     */
    public async execute(interaction: BaseInteraction): Promise<void> {
        await RegisterFact<User>(interaction.user, undefined);
        await RegisterFact<Channel>(interaction.channel!, undefined);

        const available_cmds = new Map<string, BaseCommand | CustomizableCommand>([
            ...(CommandLoader.BotCommands.get('global') ?? new Map()),
            ...(CommandLoader.BotCommands.get(interaction.guildId ?? interaction.guild?.id ?? '') ?? new Map()),
        ]);

        if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
            const name = interaction.commandName;
            let command = available_cmds.get(name);
            if (!command) command = [...available_cmds.values()].find((cmd) => cmd.pretty_name === name);
            if (!command) command = available_cmds.get(name.replaceAll(' ', '_').toLowerCase());
            if (!command) command = available_cmds.get(name.replaceAll(' ', '').toLowerCase());
            if (!command) command = [...available_cmds.values()].find((cmd) => cmd.aliases?.includes(name));
            if (!command) return;

            if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Collection());
            const timestamps = cooldowns.get(command.name)!;
            const now = Date.now();
            const ms = (command.cooldown ?? 5) * 1000;

            if (timestamps.has(BigInt(interaction.user.id))) {
                const expire = timestamps.get(BigInt(interaction.user.id))! + ms;
                if (now < expire) {
                    const left = ((expire - now) / 1000).toFixed();
                    await interaction.reply({
                        content: this.t.events({
                            caller: 'interaction',
                            key: 'execute.cooldown',
                            replacements: { command: command.name, left },
                            guild_id: BigInt(interaction.guildId!),
                        }),
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
            }

            timestamps.set(BigInt(interaction.user.id), now);
            setTimeout(() => timestamps.delete(BigInt(interaction.user.id)), ms);

            await command.execute(interaction);
            return;
        }
        if (interaction.isStringSelectMenu()) {
            await handleCommand(interaction.values[0], interaction);
            return;
        }
        if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
            await handleCommand(interaction.customId, interaction);
            return;
        }
    }
}
