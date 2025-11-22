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
import { BaseCommand } from '../../types/structure/command';

export default class PurgeCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    private static target: Message<boolean>;
    constructor() {
        super({ name: 'purge', is_admin_command: true });

        (this.base_cmd_data as SlashCommandBuilder)
            .addStringOption((o) =>
                o.setName('message_id').setRequired(true).setDescription(this.t('purge.parameters.message_id')),
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setType(ApplicationCommandType.Message | ApplicationCommandType.User)
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
    }

    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @CommandQuestionPrompt({
        title: 'command.execute.warning',
        message: 'purge.execute.are_you_sure',
        ok_label: 'command.execute.ok',
        cancel_label: 'command.execute.cancel',
        flags: MessageFlags.Ephemeral,
    })
    public async execute(interaction: ButtonInteraction | CommandInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
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
                post.setTitle(`:octagonal_sign: ${this.t('command.execute.error')}`)
                    .setDescription(this.t('purge.execute.error', { error: (err as Error).message }))
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

            post.setTitle(`:white_check_mark: ${this.t('command.execute.success')}`)
                .setDescription(this.t('purge.execute.success', { count: selected_count }))
                .setColor(Colors.Green);
            await interaction.update({ embeds: [post], components: [] });
            this.log.send('debug', 'command.execute.success', {
                name: this.name,
                guild: interaction.guild,
                user: interaction.user,
            });
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
                    post.setTitle(`:warning: ${this.t('command.execute.warning')}`)
                        .setDescription(this.t('purge.execute.message_id_required'))
                        .setColor(Colors.Yellow);
                    await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
                    return;
                }
                try {
                    PurgeCommand.target = await interaction.channel!.messages.fetch(message_id);
                } catch (err) {
                    post.setTitle(`:warning: ${this.t('command.execute.warning')}`)
                        .setDescription(this.t('purge.execute.message_not_found_in_channel'))
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
