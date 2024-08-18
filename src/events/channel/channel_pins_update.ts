import { Events, TextBasedChannel } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'pinsupdate',
    data: Events.ChannelPinsUpdate,
    execute: async (channel: TextBasedChannel, time: Date) => {
        Logger('info', `Pins update in "${channel.id}" at "${time}"`);
    },
} as Event_t;
