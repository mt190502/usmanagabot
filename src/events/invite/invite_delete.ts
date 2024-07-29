import { Events, Invite } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'inviteDelete',
    data: Events.InviteDelete,
    execute: async (invite: Invite) => {
        Logger('info', `Invite deleted: ${invite.code}'`);
    },
} as Event_t;
