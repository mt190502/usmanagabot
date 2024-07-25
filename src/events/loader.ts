import { globSync } from 'glob';
import path from 'path';
import { BotClient } from '../main';
import { Event_t } from '../types/interface/events';
import { Logger } from '../utils/logger';

export const EventLoader = async () => {
    for (const file of globSync(path.join(__dirname, './**/*.ts'), { ignore: '**/loader.ts' })) {
        const fileNameWithPath = file.match(/([^/]+\/[^/]+)$/)[0];
        const event: Event_t = (await import(file)).default;
        for (const { enabled, name, once, data, execute } of [event]) {
            if (!name) {
                Logger('warn', `Event "${fileNameWithPath}" does not have a name!`);
                continue;
            } else if (!enabled) {
                Logger('warn', `Event "${fileNameWithPath}" is disabled!`);
                continue;
            }
            const eventType = once ? 'once' : 'on';
            Logger('info', `Loading event "${name}" from "events/${fileNameWithPath}"`);
            BotClient[eventType](data, execute);
        }
    }
};
