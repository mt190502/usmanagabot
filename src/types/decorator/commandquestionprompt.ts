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
export function CommandQuestionPrompt(o: {
    title: string;
    message: string;
    ok_label: string;
    cancel_label: string;
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
                .setTitle(`:warning: ${o.title}`)
                .setDescription(o.message)
                .setColor(Colors.Yellow);

            if (interaction.isButton()) {
                if (interaction.customId.endsWith(':ok')) {
                    post.setTitle(':hourglass_flowing_sand: Processing')
                        .setDescription('Please wait...')
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
                    post.setTitle(':x: Cancelled').setDescription('Process cancelled').setColor(Colors.Red);
                    await interaction.update({ components: [], embeds: [post] });
                    InteractionResponseRegistry.delete(registry_key);
                    return;
                }
                return;
            }

            const ok_btn = new ButtonBuilder()
                .setCustomId(`command:${name}:${property_key.toString().toLowerCase()}:ok`)
                .setEmoji('✅')
                .setLabel(o.ok_label)
                .setStyle(ButtonStyle.Success);
            const cancel_btn = new ButtonBuilder()
                .setCustomId(`command:${name}:${property_key.toString().toLowerCase()}:cancel`)
                .setEmoji('❌')
                .setLabel(o.cancel_label)
                .setStyle(ButtonStyle.Danger);
            const extra = o.extra_buttons
                ? o.extra_buttons.map((b) =>
                    new ButtonBuilder()
                        .setCustomId(`command:${name}:${property_key.toString().toLowerCase()}:${b.key}`)
                        .setLabel(b.label)
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
