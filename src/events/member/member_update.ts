import { Events, GuildMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'guildMemberUpdate',
    data: Events.GuildMemberUpdate,
    execute: async (oldMember: GuildMember, newMember: GuildMember) => {
        Logger('info', `Member updated: "${newMember.user.tag} (${newMember.id})"`);
    },
} as Event_t;
