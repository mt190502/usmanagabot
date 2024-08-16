import { Message, SlashCommandBuilder } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Afk } from "../../types/database/afk";
import { Guilds } from "../../types/database/guilds";
import { Users } from "../../types/database/users";
import { Command_t } from "../../types/interface/commands";

const exec = async (interaction: any) => {
    const user_afk = await DatabaseConnection.manager.findOne(Afk, { where: { from_user: { uid: interaction.user.id } } });
    if (user_afk) return interaction.reply({ content: 'You are already **AFK**\n' + (user_afk.message ? `**Reason:** ${user_afk.message}` : ''), ephemeral: true });

    const afk = new Afk()
    const reason = interaction.options.getString('reason');
    if (reason) afk.message = reason;
    afk.from_user = await DatabaseConnection.manager.findOne(Users, { where: { uid: interaction.user.id } });
    afk.from_guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });    
    DatabaseConnection.manager.save(afk).then(async () => {
        interaction.member.setNickname(interaction.member.nickname ? '[AFK] ' + interaction.member.nickname : '[AFK] ' + interaction.user.displayName ).catch(() => {});
        interaction.reply({ content: 'You are now **AFK**\n' + (reason ? `**Reason:** ${reason}\n` : '') + (interaction.member.manageable ? '' : '**Warning:** I am unable to change your nickname (Probably due to role hierarchy)'), ephemeral: true }).catch(() => {});
    });
}

const scb = async (): Promise<Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">> => {
    const data = new SlashCommandBuilder().setName('afk').setDescription("Away from keyboard");
    data.addStringOption(option => option.setName('reason').setDescription('Reason for being afk').setRequired(true));
    return data;
}

const exec_when_event = async (event_name: string, message: Message) => {
    switch (event_name) {
        case 'messageCreate':
            const user_afk = await DatabaseConnection.manager.findOne(Afk, { where: { from_user: { uid: BigInt(message.author.id) } } });
            if (user_afk?.from_user.uid == BigInt(message.author.id)) {
                message.member?.setNickname(message.member.nickname?.replaceAll('[AFK]', '')).catch(() => {});
                message.reply({ content: 'You are no longer **AFK**' + (user_afk.mentions.length > 0 ? `\nYou were mentioned **${user_afk.mentions.length}** times while you were **AFK** and I have sent you a DM with the message urls` : '') }).catch(() => {});
                if (user_afk.mentions.length > 0) {
                    message.author.send({ content: `You were mentioned while you were **AFK**\n` + user_afk.mentions.join('\n'), }).catch(() => {});
                }
                DatabaseConnection.manager.delete(Afk, user_afk.id);
                return
            }
            for (const mention of message.mentions.users) {
                let mentioned_user_afk = await DatabaseConnection.manager.findOne(Afk, { where: { from_user: { uid: BigInt(mention[0]) } } });
                if (mentioned_user_afk) {
                    message.reply({ content: `**${mention[1].username}** is **AFK**\n` + (mentioned_user_afk.message ? `**Reason:** ${mentioned_user_afk.message}` : ''), allowedMentions: { parse: [] } }).catch(() => {});
                    mentioned_user_afk.mentions.push(message.url);
                    DatabaseConnection.manager.save(mentioned_user_afk);
                }
            }
        break;
    }
}

export default {
    enabled: true,
    name: 'afk',
    type: 'standard',
    description: 'Away from keyboard',

    category: 'tools',
    cooldown: 5,
    usage: '/afk <reason>',
    usewithevent: ['messageCreate'],

    data: scb,
    execute: exec,
    execute_when_event: exec_when_event,
} as Command_t;