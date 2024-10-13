import { Events, GuildChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'channelUpdate',
    data: Events.ChannelUpdate,
    execute: async (oldChannel: GuildChannel, newChannel: GuildChannel) => {
        Logger(
            'info',
            `Channel "${oldChannel.name}" updated to "${newChannel.name}" in guild "${oldChannel.guild.name}"`
        );
    },
} as Event_t;
