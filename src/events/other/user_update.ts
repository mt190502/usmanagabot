import { Events, User } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'userUpdate',
    data: Events.UserUpdate,
    execute: async (old_user: User, new_user: User) => {
        Logger('info', `${old_user.tag} updated their profile to ${new_user.tag}`);
    },
} as Event_t;
