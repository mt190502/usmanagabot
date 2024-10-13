import { Events, Guild } from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Event_t } from '../../types/interface/events';
import { Logger } from '../../utils/logger';

export default {
    enabled: true,
    once: false,
    name: 'guildUpdate',
    data: Events.GuildUpdate,
    execute: async (oldGuild: Guild, newGuild: Guild) => {
        Logger('info', `Guild is updated: "${oldGuild.name}" (${oldGuild.id}) -> "${newGuild.name}" (${newGuild.id})`);

        let success = false;
        try {
            const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: BigInt(oldGuild.id) } });
            if (guild) {
                guild.name = newGuild.name;
                await DatabaseConnection.manager.save(guild);
                success = true;
            }
        } catch (error) {
            Logger('warn', `Failed to update guilds to database: ${error}`);
        }
        if (success) {
            Logger(
                'info',
                `Guild "${oldGuild.name} (${oldGuild.id})" updated to "${newGuild.name} (${newGuild.id})" in database`
            );
        }
    },
} as Event_t;
