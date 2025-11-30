import { Logger } from '@services/logger';
import { BaseEvent } from '@src/types/structure/event';
import { Client, ClientEvents } from 'discord.js';
import { glob } from 'glob';
import path from 'path';

/**
 * Manages the discovery and registration of Discord.js event handlers.
 *
 * This class is responsible for:
 * - Scanning the filesystem to find event modules.
 * - Registering event handlers with the Discord client, supporting both `on` and `once` events.
 * - Maintaining a collection of loaded events for easy access.
 *
 * To use, call `EventLoader.init(client)` during the bot's startup process.
 */
export class EventLoader {
    /**
     * An in-memory registry of all loaded event handlers.
     *
     * The keys are the event names (from `ClientEvents`), and the values are the corresponding `BaseEvent` instances.
     *
     * @public
     * @static
     * @type {Record<string, BaseEvent<keyof ClientEvents>>}
     */
    public static BotEvents: Record<string, BaseEvent<keyof ClientEvents>> = {};

    /**
     * Initializes the EventLoader by discovering and registering all event handlers.
     *
     * This method scans the events directory, loads each event file, and attaches its handler to the Discord client.
     * It ensures that it only runs once, making subsequent calls have no effect.
     *
     * @public
     * @static
     * @async
     * @param {Client} client The Discord client instance to attach the event handlers to.
     * @returns {Promise<Client>} A promise that resolves to the client instance with all events registered.
     */
    public static async init(client: Client): Promise<Client> {
        for (const file of await glob(path.join(__dirname, './**/*.ts'), { ignore: '**/index.ts' })) {
            const file_name_with_path = file.match(/([^/]+\/[^/]+\/[^/]+)$/)![0];
            const event_classes = (await import(file)).default;
            const events = Array.isArray(event_classes) ? event_classes : [event_classes];

            for (const event_class of events) {
                const event = new event_class() as BaseEvent<keyof ClientEvents>;
                if (!event.enabled) {
                    Logger.send('services', 'event_loader', 'info', 'disabled', { event: event.type, filename: file_name_with_path });
                    continue;
                }
                Logger.send('services', 'event_loader', 'log', 'loading', { event: event.type, filename: file_name_with_path });
                EventLoader.BotEvents[event.type] = event;
                client[event.once ? 'once' : 'on'](event.type, (...args) => event.execute(...args));
            }
        }
        return client;
    }
}
