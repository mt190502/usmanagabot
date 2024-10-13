import { Events, Guild } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'guildCreate',
    data: Events.GuildCreate,
    execute: async (guild: Guild) => {
        Logger('info', `Bot is added: "${guild.name} (${guild.id})"`);

        let success = false;
        try {
            const newGuild = new Guilds();
            newGuild.name = guild.name;
            newGuild.gid = BigInt(guild.id);
            await DatabaseConnection.manager.save(newGuild);
            success = true;
        } catch (error) {
            Logger('warn', `Failed to save guilds to database: ${error}`);
        }
        if (success) Logger('info', `Guild "${guild.name} (${guild.id})" added to database`);
    },
} as Event_t;
