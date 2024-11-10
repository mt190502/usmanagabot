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
    execute: async (old_guild: Guild, new_guild: Guild) => {
        Logger('info', `Guild is updated: "${old_guild.name}" (${old_guild.id}) -> "${new_guild.name}" (${new_guild.id})`);

        let success = false;
        try {
            const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: BigInt(old_guild.id) } });
            if (guild) {
                guild.name = new_guild.name;
                await DatabaseConnection.manager.save(guild);
                success = true;
            }
        } catch (error) {
            Logger('warn', `Failed to update guilds to database: ${error}`);
        }
        if (success) {
            Logger(
                'info',
                `Guild "${old_guild.name} (${old_guild.id})" updated to "${new_guild.name} (${new_guild.id})" in database`
            );
        }
    },
} as Event_t;
