import {
    ActionRowBuilder,
    Channel,
    Collection,
    CommandInteraction,
    Events,
    Interaction,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    User,
} from 'discord.js';
import { CommandLoader } from '../commands';
import { BaseCommand, CustomizableCommand } from '../types/structure/command';
import { BaseEvent } from '../types/structure/event';
import { RegisterFact } from '../utils/common';

const handleCommand = async (action: string, interaction: Interaction | CommandInteraction) => {
    const [namespace, command_name, ...args] = action.split(':');
    const command =
        CommandLoader.BotCommands.get(interaction.guild!.id)?.get(command_name) ||
        CommandLoader.BotCommands.get('global')?.get(command_name);
    if (!command) return;
    const target = Reflect.getMetadata(`custom:${namespace}`, command.constructor);

    if (namespace === 'command') {
        if (target) target.get(args[0])?.value(interaction, ...args);
    } else if (namespace === 'settings' && command instanceof CustomizableCommand) {
        if (args.length === 1) {
            target.get(args[0])?.value(interaction, ...args);
        } else if (args) {
            const subcommands: { label: string; description: string; value: string }[] = [];
            for (const [name, setting] of target) {
                subcommands.push({
                    label: name,
                    description: setting.desc,
                    value: `settings:${command.name}:${name}`,
                });
            }
            await (interaction as StringSelectMenuInteraction).update({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('settings')
                                .setPlaceholder('Select a setting to configure...')
                                .addOptions(subcommands),
                        )
                        .toJSON(),
                ],
            });
        }
    }
};

const cooldowns: Collection<string, Collection<bigint, number>> = new Collection();

export default class InteractionEvent extends BaseEvent<Events.InteractionCreate> {
    constructor() {
        super({ enabled: true, type: Events.InteractionCreate, once: false });
    }

    public async execute(interaction: Interaction): Promise<void> {
        await RegisterFact<User>(interaction.user, undefined);
        await RegisterFact<Channel>(interaction.channel!, undefined);

        const available_cmds = new Map<string, BaseCommand | CustomizableCommand>([
            ...(CommandLoader.BotCommands.get('global') ?? new Map()),
            ...(CommandLoader.BotCommands.get(interaction.guildId ?? interaction.guild?.id ?? '') ?? new Map()),
        ]);

        if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
            const req = interaction.commandName.replaceAll(' ', '_').toLowerCase();
            let command = available_cmds.get(req);
            if (!command) {
                for (const [, cmd] of available_cmds) {
                    if (cmd.aliases?.includes(req)) {
                        command = cmd;
                        break;
                    }
                }
            }
            if (!command) return;

            if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Collection());
            const timestamps = cooldowns.get(command.name)!;
            const now = Date.now();
            const ms = (command.cooldown ?? 5) * 1000;

            if (timestamps.has(BigInt(interaction.user.id))) {
                const expire = timestamps.get(BigInt(interaction.user.id))! + ms;
                if (now < expire) {
                    const left = ((expire - now) / 1000).toFixed();
                    interaction.reply({
                        content: `Please wait ${left} second(s) before reusing the \`${command.name}\` command.`,
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
