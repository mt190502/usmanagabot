import { Collection, Events, Message, Snowflake } from 'discord.js';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: false,
    once: false,
    name: 'messageDeleteBulk',
    data: Events.MessageBulkDelete,
    execute: async (messages: Collection<Snowflake, Message>) => {
        Logger('info', `${messages.size} messages were deleted in ${messages.first().channel.id}`);
    },
} as Event_t;
