import {
    ApplicationCommandType,
    ChatInputCommandInteraction,
    ColorResolvable,
    Colors,
    ContextMenuCommandBuilder,
    EmbedBuilder,
    MessageContextMenuCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    User,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Introduction, IntroductionSubmit } from '../../types/database/introduction';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const exec = async (interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction): Promise<void> => {
    let user: User;
    if (interaction.isMessageContextMenuCommand()) {
        user = interaction.targetMessage.author;
    } else if (interaction.isChatInputCommand()) {
        user = interaction.options.getUser('user') || interaction.user;
    }

    if (!interaction.guild.members.cache.get(user.id)) {
        const post = new EmbedBuilder()
            .setTitle(':warning: Warning')
            .setDescription('User not found.')
            .setColor(Colors.Yellow);
        await interaction.reply({ embeds: [post], ephemeral: true });
        return;
    }

    const user_roles = interaction.guild.members.cache
        .get(user.id)
        ?.roles.cache.sort((a, b) => b.position - a.position);
    const introduction = await DatabaseConnection.manager
        .findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });
    const data: string[] = [];

    if (introduction) {
        const last_introduction_submit = await DatabaseConnection.manager
            .findOne(IntroductionSubmit, {
                where: { from_user: { uid: BigInt(user.id) }, from_guild: { gid: BigInt(interaction.guild.id) } },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        if (last_introduction_submit) {
            data.push(`**__About ${user.username}__**\n`);
            for (let i = 1; i <= 8; i++) {
                const key = introduction[`col${i}` as keyof Introduction];
                if (Array.isArray(key)) {
                    const value = (last_introduction_submit[`col${i}` as keyof IntroductionSubmit] as string) || null;
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
        `**Joined At**: <t:${Math.floor(interaction.guild.members.cache.get(user.id)?.joinedTimestamp / 1000)}:R>\n`,
        `**Roles**: ${
            user_roles
                .filter((r) => r.name !== '@everyone')
                .map((r) => `<@&${r.id}>`)
                .join(', ') || 'None'
        }\n`
    );

    const color = user_roles.map((r) => r.hexColor).find((c) => c !== '#000000') as ColorResolvable;
    const embed = new EmbedBuilder()
        .setDescription(data.join(''))
        .setColor(color || 'Random')
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
};

const cmcb = (): ContextMenuCommandBuilder => {
    return new ContextMenuCommandBuilder()
        .setName('User Information')
        .setType(ApplicationCommandType.User | ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
};

const scb = (): Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> => {
    const data = new SlashCommandBuilder().setName('user_information').setDescription('View user(s) profile.');
    data.addUserOption((option) => option.setName('user').setDescription('User to view profile').setRequired(false));
    return data;
};

export default {
    enabled: true,
    name: 'user_information',
    type: 'standard',

    description: 'View user(s) profile.',
    category: 'misc',
    cooldown: 5,
    usage: '/user_information <@user?>',

    data: [cmcb, scb],
    execute: exec,
} as Command_t;
