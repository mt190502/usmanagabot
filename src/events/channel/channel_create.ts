import { Events, GuildChannel } from 'discord.js';
import { Logger } from '../../utils/logger';
import { Event_t } from '../../types/interface/events';


export default {
    enabled: true,
    once: false,
    name: 'channelCreate',
    data: Events.ChannelCreate,
    execute: async (channel: GuildChannel) => {
        Logger('info', `Channel Created: "${channel.name} (${channel.id})"`);
    },
} as Event_t;
