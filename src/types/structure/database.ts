import { EntityManager } from 'typeorm';
import { Guilds } from '../database/entities/guilds';
import { Users } from '../database/entities/users';

export type DatabaseManager = {
    getGuild: (guild_id: bigint) => Promise<Guilds | undefined>;
    getUser: (user_id: bigint) => Promise<Users | undefined>;
} & EntityManager;
