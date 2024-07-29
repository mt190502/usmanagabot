import { Events, GuildMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'guildMemberRemove',
    data: Events.GuildMemberRemove,
    execute: async (member: GuildMember) => {
        Logger('info', `Member left: "${member.user.tag} (${member.id})"`);
    },
} as Event_t;
