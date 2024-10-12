import { ChatInputCommandInteraction, GuildMember, Message, SlashCommandBuilder } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Afk } from '../../types/database/afk';
import { Guilds } from '../../types/database/guilds';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const exec = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    try {
        const user_afk = await DatabaseConnection.manager.findOne(Afk, {
            where: { from_user: { uid: BigInt(interaction.user.id) } },
        });

        if (user_afk) {
            await interaction.reply({
                content: 'You are already **AFK**\n' + (user_afk.message ? `**Reason:** ${user_afk.message}` : ''),
                ephemeral: true,
            });
            return;
        }

        const afk = new Afk();
        const reason = interaction.options.getString('reason');
        const member: GuildMember = interaction.member as GuildMember;

        if (reason) afk.message = reason;
        afk.from_user = await DatabaseConnection.manager.findOne(Users, {
            where: { uid: BigInt(interaction.user.id) },
        });
        afk.from_guild = await DatabaseConnection.manager.findOne(Guilds, {
            where: { gid: BigInt(interaction.guild.id) },
        });

        await DatabaseConnection.manager.save(afk);
        await member
            .setNickname(member.nickname ? '[AFK] ' + member.nickname : '[AFK] ' + interaction.user.displayName)
            .catch((error: Error) => Logger('warn', error.message, interaction));

        await interaction.reply({
            content:
                'You are now **AFK**\n' +
                (reason ? `**Reason:** ${reason}\n` : '') +
                (member.manageable
                    ? ''
                    : '**Warning:** I am unable to change your nickname (Probably due to role hierarchy)'),
            ephemeral: true,
        });
    } catch (error) {
        Logger('warn', 'Error setting AFK status: ' + error.message, interaction);
        await interaction.reply({ content: 'Error setting AFK status', ephemeral: true });
    }
};

const scb = async (): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const data = new SlashCommandBuilder().setName('afk').setDescription('Away from keyboard');
    data.addStringOption((option) => option.setName('reason').setDescription('Reason for being afk').setRequired(true));
    return data;
};

const exec_when_event = async (event_name: string, message: Message) => {
    try {
        switch (event_name) {
            case 'messageCreate': {
                const user_afk = await DatabaseConnection.manager.findOne(Afk, {
                    where: { from_user: { uid: BigInt(message.author.id) } },
                });

                if (
                    user_afk?.from_user.uid == BigInt(message.author.id) &&
                    user_afk?.from_guild.gid == BigInt(message.guild?.id)
                ) {
                    await message.member
                        ?.setNickname(message.member.nickname?.replaceAll('[AFK]', ''))
                        .catch((error: Error) => Logger('warn', error.message, message));

                    await message.reply({
                        content:
                            'You are no longer **AFK**' +
                            (user_afk.mentions.length > 0
                                ? `\nYou were mentioned **${user_afk.mentions.length}** times while you were **AFK** and I have sent you a DM with the message urls`
                                : ''),
                    });

                    if (user_afk.mentions.length > 0) {
                        await message.author
                            .send({
                                content: 'You were mentioned while you were **AFK**\n' + user_afk.mentions.join('\n'),
                            })
                            .catch((error: Error) => Logger('warn', error.message, message));
                    }
                    await DatabaseConnection.manager.delete(Afk, user_afk.id);
                }

                for (const mention of message.mentions.users) {
                    const mentioned_user_afk = await DatabaseConnection.manager.findOne(Afk, {
                        where: { from_user: { uid: BigInt(mention[0]) } },
                    });

                    if (mentioned_user_afk) {
                        await message.reply({
                            content:
                                `**${mention[1].username}** is **AFK**\n` +
                                (mentioned_user_afk.message ? `**Reason:** ${mentioned_user_afk.message}` : ''),
                            allowedMentions: { parse: [] },
                        });

                        mentioned_user_afk.mentions.push(message.url);
                        await DatabaseConnection.manager.save(mentioned_user_afk);
                    }
                }
                break;
            }
        }
    } catch (error) {
        Logger('warn', 'Error during message handling: ' + error.message, message);
    }
};

export default {
    enabled: true,
    name: 'afk',
    type: 'standard',
    description: 'Away from keyboard',

    category: 'tools',
    cooldown: 5,
    usage: '/afk <reason>',
    usewithevent: ['messageCreate'],

    data: [scb],
    execute: exec,
    execute_when_event: exec_when_event,
} as Command_t;
