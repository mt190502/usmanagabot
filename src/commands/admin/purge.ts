import {
    ApplicationCommandType,
    ButtonInteraction,
    Colors,
    CommandInteraction,
    ContextMenuCommandBuilder,
    EmbedBuilder,
    Message,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { CommandQuestionPrompt } from '../../types/decorator/commandquestionprompt';
import { Log } from '../../types/decorator/log';
import { BaseCommand } from '../../types/structure/command';

/**
 * A command for bulk-deleting messages in a channel.
 *
 * This command allows administrators to delete all messages in a channel up to a specified
 * target message. It functions as both a slash command (requiring a message ID/URL) and a
 * message context menu command.
 *
 * To prevent accidental mass deletions, it uses the `@CommandQuestionPrompt` decorator
 * to ask for confirmation from the user before proceeding.
 */
export default class PurgeCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    /**
     * Stores the target message to delete up to.
     * This is populated when the command is initiated.
     */
    private static target: Message<boolean>;

    constructor() {
        super({ name: 'purge', is_admin_command: true });

        (this.base_cmd_data as SlashCommandBuilder)
            .addStringOption((o) =>
                o.setName('message_id').setRequired(true).setDescription(this.t('parameters.message_id')),
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setNameLocalizations(this.getLocalizations('pretty_name'))
            .setType(ApplicationCommandType.Message | ApplicationCommandType.User)
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
    }

    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * Executes the purge operation.
     *
     * This method has two phases:
     * 1. **Initiation (via `CommandInteraction`):** It identifies the target message from either the
     *    context menu or the slash command's `message_id` option. It doesn't delete anything at
     *    this stage; the `@CommandQuestionPrompt` decorator intercepts the execution and shows a
     *    confirmation button to the user.
     * 2. **Confirmation (via `ButtonInteraction`):** If the user clicks the "OK" button, this method
     *    is re-invoked. It then fetches all messages between the present and the target message,
     *    deletes them in chunks of 100, and finally deletes the target message itself.
     *
     * @param interaction The interaction object, which can be from the initial command or the confirmation button.
     */
    @CommandQuestionPrompt({
        title: 'command.execute.warning',
        message: 'purge.execute.are_you_sure',
        ok_label: 'command.execute.ok',
        cancel_label: 'command.execute.cancel',
        flags: MessageFlags.Ephemeral,
    })
    @Log()
    public async execute(interaction: ButtonInteraction | CommandInteraction): Promise<void> {
        const post = new EmbedBuilder();
        if (interaction.isButton()) {
            const selected_messages: Message<boolean>[] = [];

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
                this.log.send('debug', 'command.purge.execute.delete.success', {
                    count: selected_count + 1,
                    channel: interaction.channel,
                    user: interaction.user,
                    guild: interaction.guild,
                });
            } catch (err) {
                post.setTitle(
                    `:octagonal_sign: ${this.t('command.execute.error', undefined, interaction)}`,
                )
                    .setDescription(
                        this.t('execute.error', { error: (err as Error).message }, interaction),
                    )
                    .setColor(Colors.Red);
                await interaction.update({ embeds: [post], components: [] });
                this.log.send('warn', 'command.purge.execute.delete.failed', {
                    channel: interaction.channel,
                    user: interaction.user,
                    guild: interaction.guild,
                    message: (err as Error).message,
                });
                return;
            }

            PurgeCommand.target.delete();
            selected_count++;

            post.setTitle(
                `:white_check_mark: ${this.t('command.execute.success', undefined, interaction)}`,
            )
                .setDescription(this.t('execute.success', { count: selected_count }, interaction))
                .setColor(Colors.Green);
            await interaction.update({ embeds: [post], components: [] });
        } else {
            if (interaction.isMessageContextMenuCommand()) {
                PurgeCommand.target = interaction.targetMessage;
            }
            if (interaction.isChatInputCommand()) {
                const message_id = interaction.options
                    .getString('message_id')!
                    .split('/')
                    .at(-1)!
                    .replaceAll(/(\s|<|>|@|&|!)/g, '');
                if (!message_id) {
                    post.setTitle(
                        `:warning: ${this.t('command.execute.warning', undefined, interaction)}`,
                    )
                        .setDescription(this.t('execute.message_id_required', undefined, interaction))
                        .setColor(Colors.Yellow);
                    await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
                    return;
                }
                try {
                    PurgeCommand.target = await interaction.channel!.messages.fetch(message_id);
                } catch (err) {
                    post.setTitle(
                        `:warning: ${this.t('command.execute.warning', undefined, interaction)}`,
                    )
                        .setDescription(
                            this.t('execute.message_not_found_in_channel', undefined, interaction),
                        )
                        .setColor(Colors.Yellow);
                    await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
                    this.log.send('warn', 'command.purge.execute.delete.failed', {
                        channel: interaction.channel,
                        user: interaction.user,
                        guild: interaction.guild,
                        message: (err as Error).message,
                    });
                    return;
                }
            }
        }
    }
    // ================================================================ //
}
