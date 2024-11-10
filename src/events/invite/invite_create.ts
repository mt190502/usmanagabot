import { Events, Invite } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'inviteCreate',
    data: Events.InviteCreate,
    execute: async (invite: Invite) => {
        Logger('info', `Invite created: ${invite.code}'`);
    },
} as Event_t;
