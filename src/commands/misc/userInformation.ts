import {
    ApplicationCommandType,
    ChatInputCommandInteraction,
    ColorResolvable,
    Colors,
    ContextMenuCommandBuilder,
    EmbedBuilder,
    MessageContextMenuCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
    User,
} from 'discord.js';
import { Introduction, IntroductionSubmit } from '../../types/database/entities/introduction';
import { Log } from '../../types/decorator/log';
import { BaseCommand } from '../../types/structure/command';

/**
 * Displays comprehensive information about a user.
 *
 * This command gathers and presents a user's profile information in an embed.
 * It works as a slash command, a user context menu command, and a message context menu command.
 *
 * The information includes:
 * - The user's latest introduction data, if the `introduction` command is configured.
 * - Standard Discord account details (username, ID, creation date, server join date).
 * - A list of the user's roles in the server.
 */
export default class UserInformationCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'user_information', cooldown: 5 });
        (this.base_cmd_data as SlashCommandBuilder).addUserOption((option) =>
            option.setName('user').setDescription(this.t('parameters.user')).setRequired(false),
        );
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setNameLocalizations(this.getLocalizations('pretty_name'))
            .setType(ApplicationCommandType.Message);
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setNameLocalizations(this.getLocalizations('pretty_name'))
            .setType(ApplicationCommandType.User);
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    /**
     * Executes the command to fetch and display user information.
     *
     * It determines the target user from the interaction (slash command option, context menu target,
     * or the interacting user themselves). It then fetches their introduction data and account
     * details, formats them into a single embed, and sends it as an ephemeral reply.
     *
     * @param interaction The interaction from the slash or context menu command.
     */
    @Log()
    public async execute(
        interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
    ): Promise<void> {
        let user: User;
        if (interaction.isMessageContextMenuCommand()) {
            user = interaction.targetMessage.author;
        } else {
            user = interaction.options.getUser('user') || interaction.user;
        }

        if (!interaction.guild!.members.cache.get(user.id)) {
            const post = new EmbedBuilder()
                .setTitle(`:warning: ${this.t('command.execute.warning', undefined, interaction)}`)
                .setDescription(this.t('execute.user_not_found_in_guild', { user: user.username }, interaction))
                .setColor(Colors.Yellow);
            await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
            this.log.send('warn', 'command.user_information.execute.user_not_found', {
                guild: interaction.guild,
                user: interaction.user,
                id: user.id,
            });
            return;
        }

        const user_roles = interaction
            .guild!.members.cache.get(user.id)
            ?.roles.cache.sort((a, b) => b.position - a.position);
        const introduction = await this.db.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guild!.id) } },
        });
        const data: string[] = [];

        if (introduction) {
            this.log.send('debug', 'command.user_information.execute.fetching_introduction', {
                guild: interaction.guild,
                user: interaction.user,
                id: user.id,
            });
            const last_introduction_submit = await this.db.findOne(IntroductionSubmit, {
                where: { from_user: { uid: BigInt(user.id) }, from_guild: { gid: BigInt(interaction.guild!.id) } },
            });
            if (last_introduction_submit) {
                data.push(`**__${this.t('execute.header', { user: interaction.user.username }, interaction)}__**\n`);
                for (let i = 1; i <= 8; i++) {
                    const key = introduction[`col${i}` as keyof Introduction];
                    if (Array.isArray(key)) {
                        const value =
                            (last_introduction_submit[`col${i}` as keyof IntroductionSubmit] as string) || null;
                        if (value && value.length > 0 && key[1]) {
                            data.push(`**${key[1]}**: ${value}\n`);
                            (last_introduction_submit[`col${i}` as keyof IntroductionSubmit] as string) = value;
                        }
                    }
                }
            }
        }

        data.push(
            `\n**__${this.t('execute.account_info', undefined, interaction)}__**\n`,
            `**${this.t('execute.username', undefined, interaction)}**: ${user.username}\n`,
            `**${this.t('execute.nickname', undefined, interaction)}**: <@!${user.id}>\n`,
            `**${this.t('execute.id', undefined, interaction)}**: ${user.id}\n`,
            `**${this.t('execute.created_at', undefined, interaction)}**: <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n`,
            `**${this.t('execute.joined_at', undefined, interaction)}**: <t:${Math.floor(interaction.guild!.members.cache.get(user.id)!.joinedTimestamp! / 1000)}:R>\n`,
            `**${this.t('execute.roles', undefined, interaction)}**: ${
                user_roles!
                    .filter((r) => r.name !== '@everyone')
                    .map((r) => `<@&${r.id}>`)
                    .join(', ') || this.t('execute.no_roles', undefined, interaction)
            }\n`,
        );

        const color = user_roles!.map((r) => r.hexColor).find((c) => c !== '#000000') as ColorResolvable;
        const embed = new EmbedBuilder()
            .setDescription(data.join(''))
            .setColor(color || 'Random')
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    // ================================================================ //
}
