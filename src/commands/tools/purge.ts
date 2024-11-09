import {
    ActionRowBuilder,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    ContextMenuCommandBuilder,
    EmbedBuilder,
    InteractionResponse,
    Message,
    MessageContextMenuCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

let target_message: Message;
let question_message: InteractionResponse;

const exec = async (
    interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction | ButtonInteraction
): Promise<void> => {
    const post = new EmbedBuilder();
    const ok_btn = new ButtonBuilder()
        .setCustomId('execute:purge:ok')
        .setEmoji('✅')
        .setLabel('OK')
        .setStyle(ButtonStyle.Success);
    const cancel_btn = new ButtonBuilder()
        .setCustomId('execute:purge:cancel')
        .setEmoji('❌')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger);

    if (interaction.isButton()) {
        switch (interaction.customId) {
            case 'execute:purge:ok':
                {
                    const selected_messages: Message<boolean>[] = [];
                    post.setTitle(':hourglass_flowing_sand: Processing')
                        .setDescription('Please wait...')
                        .setColor(Colors.Blue);
                    question_message.edit({ embeds: [post], components: [] });

                    let target_is_found = false;
                    let selected_count = 0;
                    let messages = await interaction.channel.messages.fetch({ limit: 100 });

                    while (!target_is_found) {
                        for (const [, message] of messages) {
                            if (message.id === target_message.id) {
                                target_is_found = true;
                                break;
                            }
                            selected_count++;
                            selected_messages.push(message);
                        }
                        if (!target_is_found) {
                            messages = await interaction.channel.messages.fetch({
                                limit: 100,
                                before: selected_messages.at(-1).id,
                            });
                        }
                    }

                    try {
                        if (selected_count >= 100) {
                            while (selected_messages.length > 0) {
                                const chunk = selected_messages.splice(0, 100);
                                await interaction.channel.bulkDelete(chunk);
                            }
                        } else {
                            await interaction.channel.bulkDelete(selected_messages);
                        }
                    } catch (err) {
                        post.setTitle(':octagonal_sign: Error')
                            .setDescription(`Failed to delete some messages\n${err.message}`)
                            .setColor(Colors.Red);
                        question_message.edit({ embeds: [post], components: [] });
                        Logger('error', err, interaction);
                        return;
                    }

                    target_message.delete();
                    selected_count++;

                    post.setTitle(':white_check_mark: Success')
                        .setDescription(`Deleted **${selected_count}** messages`)
                        .setColor(Colors.Green);
                    question_message.edit({ embeds: [post], components: [] });
                }
                break;
            case 'execute:purge:cancel':
                post.setTitle(':x: Cancelled').setDescription('Process cancelled').setColor(Colors.Red);
                question_message.edit({ embeds: [post], components: [] });
                break;
        }
    } else if (interaction.isMessageContextMenuCommand() || interaction.isChatInputCommand()) {
        if (interaction.isMessageContextMenuCommand()) {
            target_message = interaction.targetMessage;
        } else if (interaction.isChatInputCommand()) {
            const message_id = interaction.options
                .getString('message_id')
                .split('/')
                .at(-1)
                .replaceAll(/(\s|<|>|@|&|!)/g, '');
            if (!message_id) {
                post.setTitle(':warning: Warning').setDescription('Message ID is required').setColor(Colors.Yellow);
                await interaction.reply({ embeds: [post], ephemeral: true });
                return;
            }
            try {
                target_message = await interaction.channel.messages.fetch(message_id);
            } catch (err) {
                post.setTitle(':warning: Warning')
                    .setDescription(
                        'Message not found in this channel\nAre you sure the message ID is correct or the message is in this channel?'
                    )
                    .setColor(Colors.Yellow);
                interaction.reply({ embeds: [post], ephemeral: true });
                Logger('error', err, interaction);
                return;
            }
        }
        post.setTitle(':warning: Warning')
            .setDescription('Are you sure you want to purge messages?')
            .setColor(Colors.Yellow);
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents([ok_btn, cancel_btn]);
        question_message = await interaction.reply({ embeds: [post], components: [buttons], ephemeral: true });
    }
};

const cmcb = (): ContextMenuCommandBuilder => {
    return new ContextMenuCommandBuilder()
        .setName('Purge')
        .setType(ApplicationCommandType.Message | ApplicationCommandType.User)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
};

const scb = (): Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> => {
    const data = new SlashCommandBuilder().setName('purge').setDescription('Delete messages after target message');
    data.addStringOption((option) =>
        option.setName('message_id').setDescription('Message ID to delete').setRequired(true)
    );
    data.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
    return data;
};

export default {
    enabled: true,
    name: 'purge',
    pretty_name: 'Purge',
    type: 'standard',
    description: 'Delete messages after target message',

    category: 'tools',
    cooldown: 0,
    parameters: '<message_id|message_url>?',

    data: [cmcb, scb],
    execute: exec,
} as Command_t;
