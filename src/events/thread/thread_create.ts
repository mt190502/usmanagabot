import { Events, ThreadChannel } from 'discord.js';
import { BotCommands } from '../../main';
import { Event_t } from '../../types/interface/events';

export default {
    enabled: true,
    once: false,
    name: 'threadCreate',
    data: Events.ThreadCreate,
    execute: async (thread: ThreadChannel) => {
        for (const [, cmd_data] of BotCommands.get(BigInt(thread.guild?.id)).concat(BotCommands.get(BigInt(0)))) {
            if (cmd_data.usewithevent?.includes('threadCreate')) {
                cmd_data.execute_when_event('threadCreate', thread);
            }
        }
    },
} as Event_t;
