import { ActivityType, Client, Events, Guild } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Events_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'ready',
    data: Events.ClientReady,
    execute: async (client: Client) => {
        client.user.setActivity('systemd', { type: ActivityType.Watching });
        Logger('info', `Logged in as ${client.user.tag}`);
        for (const guild of client.guilds.cache) {
            const guildInDB = await DatabaseConnection.manager.findOne(Guilds, { where: { guildID: <number><unknown>guild[0] } });
            if (!guildInDB) {
                const newGuild = new Guilds();
                newGuild.guildName = (guild[1] as Guild).name;
                newGuild.guildID = <number><unknown>guild[0];
                await DatabaseConnection.manager.save(newGuild);
            }
        }
    },
} as Events_t;
