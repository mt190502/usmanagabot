import { Events, GuildMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';
import { BotCommands } from '../../main';

const exec = async (member: GuildMember) => {
    Logger('info', `Member joined: "${member.user.tag} (${member.id})"`);
    for (const cmd_data of BotCommands.get(BigInt(member.guild.id)).values()) {
        if ((cmd_data.usewithevent?.includes('guildMemberAdd'))) {
            cmd_data.execute_when_event('guildMemberAdd', member);
        }
    }
}
export default {
    enabled: true,
    once: false,
    name: 'guildMemberAdd',
    data: Events.GuildMemberAdd,
    execute: exec,
} as Event_t;
