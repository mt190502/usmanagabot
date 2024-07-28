import { Events, User } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'userUpdate',
    data: Events.UserUpdate,
    execute: async (oldUser: User, newUser: User) => {
        Logger('info', `${oldUser.tag} updated their profile to ${newUser.tag}`);
    },
} as Event_t;
