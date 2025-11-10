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
import { BaseCommand } from '../../types/structure/command';

export default class UserInfoCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'userinfo',
            pretty_name: 'User Info',
            description: 'Get information about a user.',
            cooldown: 5,
            help: `
                Use this command to get detailed information about a user, including their account details and roles within the server.

                **Usage:**
                - \`/userinfo [user]\`
                
                **Options:**
                - \`user\` (optional): The user you want to get information about. If not provided, it defaults to yourself.

                **Example:**
                - \`/userinfo user:@Username\`
            `,
        });
        (this.base_cmd_data as SlashCommandBuilder).addUserOption((option) =>
            option.setName('user').setDescription('The user to get information about').setRequired(false),
        );
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setType(ApplicationCommandType.User | ApplicationCommandType.Message);
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
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
                .setTitle(':warning: Warning')
                .setDescription('User not found.')
                .setColor(Colors.Yellow);
            await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
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
            const last_introduction_submit = await this.db.findOne(IntroductionSubmit, {
                where: { from_user: { uid: BigInt(user.id) }, from_guild: { gid: BigInt(interaction.guild!.id) } },
            });
            if (last_introduction_submit) {
                data.push(`**__About ${user.username}__**\n`);
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
            '\n**__Account Information__**\n',
            `**Username**: ${user.username}\n`,
            `**Nickname**: <@!${user.id}>\n`,
            `**ID**: ${user.id}\n`,
            `**Created At**: <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n`,
            `**Joined At**: <t:${Math.floor(interaction.guild!.members.cache.get(user.id)!.joinedTimestamp! / 1000)}:R>\n`,
            `**Roles**: ${
                user_roles!
                    .filter((r) => r.name !== '@everyone')
                    .map((r) => `<@&${r.id}>`)
                    .join(', ') || 'None'
            }\n`,
        );

        const color = user_roles!.map((r) => r.hexColor).find((c) => c !== '#000000') as ColorResolvable;
        const embed = new EmbedBuilder()
            .setDescription(data.join(''))
            .setColor(color || 'Random')
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
    // ================================================================ //
}
