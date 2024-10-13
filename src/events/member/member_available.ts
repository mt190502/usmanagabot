import { Events, GuildMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'messageCreate',
    data: Events.GuildMemberAvailable,
    execute: async (member: GuildMember) => {
        Logger('info', `Member available: "${member.user.tag} (${member.id})"`);
    },
} as Event_t;
