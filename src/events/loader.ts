import { globSync } from 'glob';
import path from 'path';
import { BotClient } from '../main';
import { Event_t } from '../types/interface/events';
import { Logger } from '../utils/logger';

export const EventLoader = async () => {
    for (const file of globSync(path.join(__dirname, './**/*.ts'), { ignore: '**/loader.ts' })) {
        const file_name_with_path = file.match(/([^/]+\/[^/]+)$/)[0];
        const { enabled, name, once, data, execute }: Event_t = (await import(file)).default;
        if (!enabled) {
            Logger('warn', `Event "${file_name_with_path}" is disabled!`);
            continue;
        } else if (!name) {
            Logger('warn', `Event "${file_name_with_path}" does not have a name!`);
            continue;
        }
        const event_type = once ? 'once' : 'on';
        Logger('info', `Loading event "${name}" from "events/${file_name_with_path}"`);
        BotClient[event_type](data, execute);
    }
};
