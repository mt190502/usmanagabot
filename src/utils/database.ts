import { glob } from 'glob';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DatabaseConfiguration_t } from '../types/interface/database';
import { Logger } from './logger';

export const DatabaseLoader = async (database: DatabaseConfiguration_t) => {
    const dataSource = new DataSource({
        type: database.driver ? database.driver : 'postgres',
        host: database.host,
        port: database.port,
        username: database.username,
        password: database.password,
        synchronize: database.synchronize,
        logging: database.logging,
        entities: await glob('src/types/database/*.ts'),
        subscribers: await glob('src/types/database/subscribers/*.ts'),
        migrations: await glob('src/types/database/migrations/*.ts'),
    });

    await dataSource
        .initialize()
        .then(() => {
            Logger('info', 'Database initialized');
        })
        .catch((err: Error) => {
            Logger('error', err.message);
        });

    return dataSource;
};
