import {
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    GuildMember,
    Message,
    SlashCommandBuilder,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Afk } from '../../types/database/afk';
import { Guilds } from '../../types/database/guilds';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const exec = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const user_afk = await DatabaseConnection.manager
        .findOne(Afk, {
            where: { from_user: { uid: BigInt(interaction.user.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    const post = new EmbedBuilder();

    if (user_afk) {
        post.setTitle(':warning: You are already AFK').setColor(Colors.Yellow);
        await interaction.reply({
            embeds: [post],
            ephemeral: true,
        });
        return;
    }

    const afk = new Afk();
    const reason = interaction.options.getString('reason');
    const member: GuildMember = interaction.member as GuildMember;

    if (reason) afk.message = reason;
    afk.from_user = await DatabaseConnection.manager
        .findOne(Users, {
            where: { uid: BigInt(interaction.user.id) },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });
    afk.from_guild = await DatabaseConnection.manager
        .findOne(Guilds, {
            where: { gid: BigInt(interaction.guild.id) },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    await DatabaseConnection.manager.save(afk).catch((err) => {
        Logger('error', err, interaction);
    });
    await member
        .setNickname(member.nickname ? '[AFK] ' + member.nickname : '[AFK] ' + interaction.user.displayName)
        .catch((error: Error) => Logger('warn', error.message, interaction));

    post.setTitle(':white_check_mark: You are now AFK').setColor(Colors.Green);
    if (!member.manageable) {
        post.setDescription('**Warning:** I am unable to change your nickname (Probably due to role hierarchy)');
    }
    await interaction.reply({
        embeds: [post],
        ephemeral: true,
    });
};

const scb = async (): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const data = new SlashCommandBuilder().setName('afk').setDescription('Away from keyboard');
    data.addStringOption((option) => option.setName('reason').setDescription('Reason for being afk').setRequired(true));
    return data;
};

const exec_when_event = async (event_name: string, message: Message) => {
    const post = new EmbedBuilder();
    switch (event_name) {
        case 'messageCreate': {
            const user_afk = await DatabaseConnection.manager
                .findOne(Afk, {
                    where: { from_user: { uid: BigInt(message.author.id) } },
                })
                .catch((err) => {
                    Logger('error', err, message);
                    throw err;
                });

            if (
                user_afk?.from_user.uid == BigInt(message.author.id) &&
                user_afk?.from_guild.gid == BigInt(message.guild?.id)
            ) {
                await message.member
                    ?.setNickname(message.member.nickname?.replaceAll('[AFK]', ''))
                    .catch((error: Error) => Logger('warn', error.message, message));

                post.setTitle(':white_check_mark: You are no longer AFK').setColor(Colors.Green);
                if (user_afk.mentions.length > 0) {
                    post.setDescription(
                        `You were mentioned **${user_afk.mentions.length}** times while you were **AFK** and I have sent you a DM with the message urls`
                    );
                }
                await message.reply({
                    embeds: [post],
                });

                if (user_afk.mentions.length > 0) {
                    await message.author
                        .send({
                            content: 'You were mentioned while you were **AFK**\n' + user_afk.mentions.join('\n'),
                        })
                        .catch((error: Error) => Logger('warn', error.message, message));
                }
                await DatabaseConnection.manager.delete(Afk, user_afk.id).catch((err) => {
                    Logger('error', err, message);
                });
            }

            for (const mention of message.mentions.users) {
                const mentioned_user_afk = await DatabaseConnection.manager
                    .findOne(Afk, {
                        where: { from_user: { uid: BigInt(mention[0]) } },
                    })
                    .catch((err) => {
                        Logger('error', err, message);
                        throw err;
                    });

                if (mentioned_user_afk) {
                    post.setTitle(':warning: User is AFK').setColor(Colors.Yellow);
                    if (mentioned_user_afk.message) {
                        post.setDescription(`**Reason:** ${mentioned_user_afk.message}`);
                    }
                    await message.reply({
                        embeds: [post],
                        allowedMentions: { parse: [] },
                    });

                    mentioned_user_afk.mentions.push(message.url);
                    await DatabaseConnection.manager.save(mentioned_user_afk).catch((err) => {
                        Logger('error', err, message);
                    });
                }
            }
            break;
        }
    }
};

export default {
    enabled: true,
    name: 'afk',
    pretty_name: 'AFK',
    type: 'standard',
    description: 'Away from keyboard',

    category: 'tools',
    cooldown: 5,
    parameters: '<reason>',
    usewithevent: ['messageCreate'],

    data: [scb],
    execute: exec,
    execute_when_event: exec_when_event,
} as Command_t;
