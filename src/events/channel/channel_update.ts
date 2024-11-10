import { Events, GuildChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'channelUpdate',
    data: Events.ChannelUpdate,
    execute: async (old_channel: GuildChannel, new_channel: GuildChannel) => {
        Logger(
            'info',
            `Channel "${old_channel.name}" updated to "${new_channel.name}" in guild "${old_channel.guild.name}"`
        );
    },
} as Event_t;
