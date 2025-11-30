import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Colors,
    ComponentEmojiResolvable,
    ContextMenuCommandInteraction,
    EmbedBuilder,
    InteractionReplyOptions,
    StringSelectMenuInteraction,
} from 'discord.js';
import { InteractionResponseRegistry } from '../../utils/interactionRegistry';
import { BaseCommand, CustomizableCommand } from '../structure/command';
import { Translator } from '../../services/translator';

/**
 * This module provides the `@CommandQuestionPrompt` decorator, which wraps a command
 * method to require user confirmation via buttons before execution.
 */

/**
 * The translation function scoped to the 'commands' namespace.
 * @private
 * @static
 * @type {(options: { key: string; replacements?: { [key: string]: unknown }; guild_id?: bigint }) => string}
 */
const t = Translator.generateQueryFunc({ caller: '' });

/**
 * A method decorator that intercepts a command's execution to ask the user for confirmation.
 *
 * It presents the user with a prompt and "OK" / "Cancel" buttons. The original
 * command method is only executed if the user clicks "OK". The interaction response
 * is managed via the `InteractionResponseRegistry` to ensure messages can be edited correctly.
 *
 * @param {object} o Configuration options for the confirmation prompt.
 * @param {string} o.title The localization key for the prompt's title.
 * @param {string} o.message The localization key for the prompt's message.
 * @param {string} o.ok_label The localization key for the confirmation button's label.
 * @param {string} o.cancel_label The localization key for the cancellation button's label.
 * @param {InteractionReplyOptions['flags']} [o.flags] Optional flags for the reply (e.g., `MessageFlags.Ephemeral`).
 * @param {object[]} [o.extra_buttons] An array of extra custom buttons to add to the prompt.
 */
export function CommandQuestionPrompt(o: {
    message: string;
    ok_label?: string;
    cancel_label?: string;
    flags?: InteractionReplyOptions['flags'];
    extra_buttons?: {
        key: string;
        label: string;
        emoji?: ComponentEmojiResolvable;
        style?: ButtonStyle;
    }[];
}): MethodDecorator {
    return (target_class, property_key, descriptor: PropertyDescriptor) => {
        const name = new (target_class.constructor as new () => BaseCommand)().name;
        const metadata: Map<string, typeof descriptor> =
            Reflect.getMetadata('custom:command', target_class.constructor) ?? new Map();

        const orig = descriptor.value;
        descriptor.value = async function(
            this: BaseCommand | CustomizableCommand,
            interaction: ContextMenuCommandInteraction | StringSelectMenuInteraction | ButtonInteraction,
            ...args: unknown[]
        ): Promise<void> {
            const registry_key = InteractionResponseRegistry.generateKey(
                interaction,
                name,
                property_key.toString().toLowerCase(),
            );

            const post = new EmbedBuilder()
                .setTitle(`:warning: ${t.system({ caller: 'messages', key: 'warning', guild_id: BigInt(interaction.guildId!) })}`)
                .setDescription(t.commands({ caller: name, key: o.message, guild_id: BigInt(interaction.guildId!) }))
                .setColor(Colors.Yellow);

            if (interaction.isButton()) {
                if (interaction.customId.endsWith(':ok')) {
                    post.setTitle(`:hourglass_flowing_sand: ${t.system({ caller: 'messages', key: 'processing', guild_id: BigInt(interaction.guildId!) })}`)
                        .setDescription(t.system({ caller: 'messages', key: 'pleaseWait', guild_id: BigInt(interaction.guildId!) }))
                        .setColor(Colors.Blue);

                    const stored_response = InteractionResponseRegistry.get(registry_key);
                    if (stored_response) {
                        try {
                            await stored_response.edit({ embeds: [post], components: [] });
                        } catch {
                            await interaction.update({ embeds: [post], components: [] });
                        }
                    } else {
                        await interaction.update({ embeds: [post], components: [] });
                    }

                    await orig.apply(this, [interaction, ...args]);
                    InteractionResponseRegistry.delete(registry_key);
                } else if (interaction.customId.endsWith(':cancel')) {
                    post.setTitle(`:x: ${t.system({ caller: 'messages', key: 'operationCancelled', guild_id: BigInt(interaction.guildId!) })}`)
                        .setDescription(t.system({ caller: 'messages', key: 'operationCancelledByUser', guild_id: BigInt(interaction.guildId!) }))
                        .setColor(Colors.Red);
                    await interaction.update({ components: [], embeds: [post] });
                    InteractionResponseRegistry.delete(registry_key);
                    return;
                }
                return;
            }

            const ok_btn = new ButtonBuilder()
                .setCustomId(`command:${name}:${property_key.toString().toLowerCase()}:ok`)
                .setEmoji('✅')
                .setLabel(t.system({ caller: 'buttons', key: o.ok_label ?? 'ok', guild_id: BigInt(interaction.guildId!) }))
                .setStyle(ButtonStyle.Success);
            const cancel_btn = new ButtonBuilder()
                .setCustomId(`command:${name}:${property_key.toString().toLowerCase()}:cancel`)
                .setEmoji('❌')
                .setLabel(t.system({ caller: 'buttons', key: o.cancel_label ?? 'cancel', guild_id: BigInt(interaction.guildId!) }))
                .setStyle(ButtonStyle.Danger);
            const extra = o.extra_buttons
                ? o.extra_buttons.map((b) =>
                    new ButtonBuilder()
                        .setCustomId(`command:${name}:${property_key.toString().toLowerCase()}:${b.key}`)
                        .setLabel(t.system({ caller: 'buttons', key: b.label, guild_id: BigInt(interaction.guildId!) }))
                        .setEmoji(b.emoji ?? '')
                        .setStyle(b.style ?? ButtonStyle.Primary),
                )
                : [];
            const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents([ok_btn, cancel_btn, ...extra]);
            metadata.set(property_key.toString().toLowerCase(), descriptor);
            Reflect.defineMetadata('custom:command', metadata, target_class.constructor);
            await orig.apply(this, [interaction, ...args]);
            if (!(interaction.replied || interaction.deferred)) {
                const response = await interaction.reply({ embeds: [post], components: [buttons], flags: o.flags });
                InteractionResponseRegistry.store(registry_key, response);
            }
        };
    };
}
