import {
    ActionRowBuilder,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Colors,
    CommandInteraction,
    ContextMenuCommandBuilder,
    EmbedBuilder,
    InteractionResponse,
    Message,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { HandleAction } from '../../types/decorator/command';
import { BaseCommand } from '../../types/structure/command';

export default class PurgeCommand extends BaseCommand {
    private static question: InteractionResponse;
    private static target: Message<boolean>;

    constructor() {
        super({
            name: 'purge',
            pretty_name: 'Purge',
            description: 'Purge messages in a channel based on various filters.',
            usage: '/purge [message_id | message_url] | Target Message > Apps > Purge',
            cooldown: 10,
            help: `
                Purge messages in a channel based on various filters.

                **Usage:**
                - \`/purge [message_id | message_url]\` - Purges messages up to the specified message ID or URL.
                - Context Menu: Right-click on a message, go to "Apps", and select "Purge" to purge messages up to that message.

                **Options:**
                - \`message_id\`: The ID of the message to start purging from.
                - \`message_url\`: The URL of the message to start purging from.

                **Examples:**
                - \`/purge 123456789012345678\` - Purges messages up to the message with ID 123456789012345678.
                - \`/purge https://discord.com/channels/123456789012345678/987654321098765432/123456789012345678\` - Purges messages up to the specified message URL.
            `,
        });
        (this.base_cmd_data as SlashCommandBuilder)
            .addStringOption((o) =>
                o
                    .setName('message_id')
                    .setRequired(true)
                    .setDescription('The ID of the message to start purging from.'),
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setType(ApplicationCommandType.Message | ApplicationCommandType.User)
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
    }

    public async execute(interaction: CommandInteraction): Promise<void> {
        const post = new EmbedBuilder();
        const ok_btn = new ButtonBuilder()
            .setCustomId('command:purge:ok')
            .setEmoji('✅')
            .setLabel('OK')
            .setStyle(ButtonStyle.Success);
        const cancel_btn = new ButtonBuilder()
            .setCustomId('command:purge:cancel')
            .setEmoji('❌')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);
        post.setTitle(':warning: Warning')
            .setDescription('Are you sure you want to purge messages?')
            .setColor(Colors.Yellow);
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents([ok_btn, cancel_btn]);

        if (interaction.isMessageContextMenuCommand()) {
            PurgeCommand.target = interaction.targetMessage;
        } else if (interaction.isChatInputCommand()) {
            const message_id = interaction.options
                .getString('message_id')!
                .split('/')
                .at(-1)!
                .replaceAll(/(\s|<|>|@|&|!)/g, '');
            if (!message_id) {
                post.setTitle(':warning: Warning').setDescription('Message ID is required').setColor(Colors.Yellow);
                await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
                return;
            }
            try {
                PurgeCommand.target = await interaction.channel!.messages.fetch(message_id);
            } catch (err) {
                post.setTitle(':warning: Warning')
                    .setDescription(
                        'Message not found in this channel\nAre you sure the message ID is correct or the message is in this channel?',
                    )
                    .setColor(Colors.Yellow);
                await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
                this.log.send('warn', 'commands.admin.purge.message_not_found', [
                    message_id,
                    interaction.channelId,
                    (err as Error).message,
                ]);
                return;
            }
        }

        PurgeCommand.question = await interaction.reply({
            embeds: [post],
            components: [buttons],
            flags: MessageFlags.Ephemeral,
        });
    }

    @HandleAction('ok')
    private async ok(interaction: ButtonInteraction): Promise<void> {
        const post = new EmbedBuilder();
        const selected_messages: Message<boolean>[] = [];
        post.setTitle(':hourglass_flowing_sand: Processing').setDescription('Please wait...').setColor(Colors.Blue);
        PurgeCommand.question.edit({ embeds: [post], components: [] });

        let target_is_found = false;
        let selected_count = 0;
        let messages = await interaction.channel!.messages.fetch({ limit: 100 });

        while (!target_is_found) {
            for (const [, message] of messages) {
                if (message.id === PurgeCommand.target.id) {
                    target_is_found = true;
                    break;
                }
                selected_count++;
                selected_messages.push(message);
            }
            if (!target_is_found) {
                messages = await interaction.channel!.messages.fetch({
                    limit: 100,
                    before: selected_messages.at(-1)!.id,
                });
            }
        }

        try {
            if (!interaction.channel?.isTextBased() || interaction.channel.isDMBased()) return;
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
                .setDescription(`Failed to delete some messages\n${(err as Error).message}`)
                .setColor(Colors.Red);
            PurgeCommand.question.edit({ embeds: [post], components: [] });
            this.log.send('error', 'commands.admin.purge.bulk_delete_failed', [
                interaction.channelId,
                (err as Error).message,
            ]);
            return;
        }

        PurgeCommand.target.delete();
        selected_count++;

        post.setTitle(':white_check_mark: Success')
            .setDescription(`Deleted **${selected_count}** messages`)
            .setColor(Colors.Green);
        PurgeCommand.question.edit({ embeds: [post], components: [] });
    }

    @HandleAction('cancel')
    private async cancel(): Promise<void> {
        const post = new EmbedBuilder();
        post.setTitle(':x: Cancelled').setDescription('Process cancelled').setColor(Colors.Red);
        PurgeCommand.question.edit({ embeds: [post], components: [] });
    }
}
