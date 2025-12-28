import { Introduction, IntroductionSubmit } from '@src/types/database/entities/introduction';
import { BaseCommand } from '@src/types/structure/command';
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
            option
                .setName('user')
                .setDescription(this.t.commands({ key: 'parameters.user.description' }))
                .setNameLocalizations(this.getLocalizations('parameters.user.name'))
                .setDescriptionLocalizations(this.getLocalizations('parameters.user.description'))
                .setRequired(false),
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
                .setTitle(
                    `:warning: ${this.t.system({ caller: 'messages', key: 'warning', guild_id: BigInt(interaction.guildId!) })}`,
                )
                .setDescription(
                    this.t.commands({
                        key: 'execute.user_not_found_in_guild',
                        replacements: { user: user.username },
                        guild_id: BigInt(interaction.guildId!),
                    }),
                )
                .setColor(Colors.Yellow);
            await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
            this.log('warn', 'execute.user_not_found', {
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
            this.log('debug', 'execute.fetching_introduction', {
                guild: interaction.guild,
                user: interaction.user,
                id: user.id,
            });
            const last_introduction_submit = await this.db.findOne(IntroductionSubmit, {
                where: { from_user: { uid: BigInt(user.id) }, from_guild: { gid: BigInt(interaction.guild!.id) } },
            });
            if (last_introduction_submit) {
                data.push(
                    `**__${this.t.commands({ key: 'execute.header', replacements: { user: interaction.user.username }, guild_id: BigInt(interaction.guildId!) })}__**\n`,
                );
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
            `\n**__${this.t.commands({ key: 'execute.account_info', guild_id: BigInt(interaction.guildId!) })}__**\n`,
            `**${this.t.commands({ key: 'execute.username', guild_id: BigInt(interaction.guildId!) })}**: ${user.username}\n`,
            `**${this.t.commands({ key: 'execute.nickname', guild_id: BigInt(interaction.guildId!) })}**: <@!${user.id}>\n`,
            `**${this.t.commands({ key: 'execute.id', guild_id: BigInt(interaction.guildId!) })}**: ${user.id}\n`,
            `**${this.t.commands({ key: 'execute.created_at', guild_id: BigInt(interaction.guildId!) })}**: <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n`,
            `**${this.t.commands({ key: 'execute.joined_at', guild_id: BigInt(interaction.guildId!) })}**: <t:${Math.floor(interaction.guild!.members.cache.get(user.id)!.joinedTimestamp! / 1000)}:R>\n`,
            `**${this.t.commands({ key: 'execute.roles', guild_id: BigInt(interaction.guildId!) })}**: ${
                user_roles!
                    .filter((r) => r.name !== '@everyone')
                    .map((r) => `<@&${r.id}>`)
                    .join(', ') || this.t.commands({ key: 'execute.no_roles', guild_id: BigInt(interaction.guildId!) })
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
