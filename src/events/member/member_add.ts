import { Events, GuildMember, TextChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';

const exec = async (member: GuildMember) => {
    Logger('info', `Member joined: "${member.user.tag} (${member.id})"`);
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: member.guild?.id } });
    if ((guild.verification_system) && (member.user.createdTimestamp > Date.now() - (guild.verification_system_minimum_days * 86400000))) {
        member.roles.add(guild.verification_system_role_id);
        (member.guild.channels.cache.get(guild.verification_system_channel_id) as TextChannel)?.send(guild.verification_system_message.replaceAll('{{user}}', `<@${member.id}>`).replaceAll('{{minimumage}}', guild.verification_system_minimum_days.toString()));
    }
}
export default {
    enabled: true,
    once: false,
    name: 'guildMemberAdd',
    data: Events.GuildMemberAdd,
    execute: exec,
} as Event_t;
