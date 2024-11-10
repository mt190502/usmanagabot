import { Events, GuildMember } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';
import { CheckAndAddUser } from '../../utils/common';

export default {
    enabled: true,
    once: false,
    name: 'guildMemberUpdate',
    data: Events.GuildMemberUpdate,
    execute: async (old_member: GuildMember, new_member: GuildMember) => {
        CheckAndAddUser(new_member.user, null);
        await Logger('info', `Member updated: "${new_member.user.tag} (${new_member.id})"`);
    },
} as Event_t;
