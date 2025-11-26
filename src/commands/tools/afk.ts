import {
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    Events,
    Message,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import { Afk } from '../../types/database/entities/afk';
import { ChainEvent } from '../../types/decorator/chainevent';
import { Log } from '../../types/decorator/log';
import { BaseCommand } from '../../types/structure/command';

/**
 * A command that allows users to set an "Away From Keyboard" (AFK) status.
 *
 * When a user sets their AFK status, the bot will:
 * - Prepend "[AFK]" to their nickname.
 * - Store their AFK status and reason in the database.
 * - Automatically remove their AFK status when they send a message.
 * - Notify users who mention them that they are AFK, providing the reason.
 * - DM the user a list of mentions they received while they were AFK.
 */
export default class AFKCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'afk', cooldown: 10 });

        (this.base_cmd_data as SlashCommandBuilder).addStringOption((option) =>
            option.setName('reason').setDescription(this.t('parameters.reason')).setRequired(true),
        );
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * Executes the /afk command.
     * Sets the user's AFK status, reason, and updates their nickname.
     * @param interaction The chat input command interaction.
     */
    @Log()
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        const member = interaction.guild!.members.cache.get(interaction.user.id)!;
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const guild = (await this.db.getGuild(BigInt(interaction.guild!.id)))!;
        const user_afk = await this.db.findOne(Afk, { where: { from_user: user, from_guild: guild } });
        const reason = interaction.options.getString('reason')!;
        const post = new EmbedBuilder();

        if (user_afk) {
            post.setTitle(`:warning: ${this.t('execute.already_afk', undefined, interaction)}`).setColor(Colors.Yellow);
            await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
            return;
        }

        const afk = new Afk();
        afk.from_user = user;
        afk.from_guild = guild;
        afk.message = reason;
        await this.db.save(afk);

        post.setTitle(`:white_check_mark: ${this.t('execute.afk_success', undefined, interaction)}`).setColor(
            Colors.Green,
        );
        if (!member.manageable) {
            post.setDescription(`:warning: ${this.t('execute.role_hierarchy_error', undefined, interaction)}`);
            this.log.send('warn', 'command.afk.execute.nickname_change_failed', {
                guild: interaction.guild,
                user: interaction.user,
            });
        } else {
            await member.setNickname(
                member.nickname ? '[AFK] ' + member.nickname : '[AFK] ' + interaction.user.displayName,
            );
        }
        await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
    }

    /**
     * Handles the `MessageCreate` event to manage AFK statuses.
     *
     * This method performs two functions:
     * 1. If a user who is AFK sends a message, it removes their AFK status, reverts their nickname, and informs them of any mentions they received.
     * 2. If a message mentions a user who is currently AFK, it informs the sender about the mentioned user's AFK status and reason.
     *
     * @param message The message that was created.
     */
    @ChainEvent({ type: Events.MessageCreate })
    @Log()
    public async onMessageCreate(message: Message<true>): Promise<void> {
        if (message?.author?.bot || !message.guild) return;
        this.log.send('debug', 'command.event.trigger.start', {
            name: 'afk',
            event: 'MessageCreate',
            guild: message.guild,
            user: message.author,
        });

        const member = message.guild.members.cache.get(message.author.id)!;
        const user = (await this.db.getUser(BigInt(message.author.id)))!;
        const guild = (await this.db.getGuild(BigInt(message.guild.id)))!;
        const user_afk = await this.db.findOne(Afk, { where: { from_user: user, from_guild: guild } });

        if (user_afk) {
            const post = new EmbedBuilder();
            if (member.manageable) await member?.setNickname(member.nickname!.replaceAll('[AFK]', ''));
            post.setTitle(
                `:white_check_mark: ${this.t('events.onmessagecreate.no_longer_afk', undefined, message)}`,
            ).setColor(Colors.Green);
            if (user_afk.mentions.length > 0) {
                post.setDescription(
                    this.t('events.onmessagecreate.mentions', { length: user_afk.mentions.length }, message),
                );
                await message.author.send({
                    content: this.t(
                        'events.onmessagecreate.dm_description',
                        {
                            message_list: user_afk.mentions.join('\n'),
                        },
                        message,
                    ),
                });
            }
            await this.db.delete(Afk, { id: user_afk.id });
            await message.reply({ embeds: [post] });
        }
        for (const mention of message.mentions.users) {
            const mentioned_user_afk = await this.db.findOne(Afk, {
                where: { from_user: { uid: BigInt(mention[0]) }, from_guild: guild },
            });
            if (mentioned_user_afk) {
                const post = new EmbedBuilder();
                post.setTitle(`:warning: ${this.t('events.onmessagecreate.afk_info', undefined, message)}`).setColor(
                    Colors.Yellow,
                );
                if (mentioned_user_afk.message) {
                    post.setDescription(
                        `${this.t('events.onmessagecreate.afk_reason', { reason: mentioned_user_afk.message }, message)}`,
                    );
                }
                await message.reply({
                    embeds: [post],
                    allowedMentions: { parse: [] },
                });

                mentioned_user_afk.mentions.push(message.url);
                await this.db.save(mentioned_user_afk);
            }
        }
        this.log.send('debug', 'command.event.trigger.success', {
            name: 'afk',
            event: 'MessageCreate',
            guild: message.guild,
            user: message.author,
        });
    }
    // ================================================================ //
}
