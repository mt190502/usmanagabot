import { Events, GuildChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'channelDelete',
    data: Events.ChannelDelete,
    execute: async (channel: GuildChannel) => {
        Logger('info', `Channel Deleted: "${channel.name} (${channel.id})"`);
    },
} as Event_t;
