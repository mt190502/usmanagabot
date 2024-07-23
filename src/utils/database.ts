import { globSync } from 'glob';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DatabaseConfiguration_t } from '../types/interface/database';
import { Logger } from './logger';

export const DatabaseLoader = (database: DatabaseConfiguration_t) => {
    const dataSource = new DataSource({
        type: database.driver ? database.driver : 'postgres',
        host: database.host,
        port: database.port,
        username: database.username,
        password: database.password,
        synchronize: database.synchronize,
        logging: database.logging,
        entities: globSync('src/types/database/*.ts', { ignore: 'src/types/database/base.ts' }),
        subscribers: globSync('src/types/database/subscribers/*.ts', { ignore: 'src/types/database/subscribers/base.ts' }),
        migrations: globSync('src/types/database/migrations/*.ts', { ignore: 'src/types/database/migrations/base.ts' }),
    });

    dataSource.initialize().then(() => {
            Logger('info', 'Database initialized')
        }).catch((err: Error) => {
            Logger('error', err.message);
        });

    return dataSource;
};

