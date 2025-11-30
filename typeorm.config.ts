import fs from 'fs';
import { parse } from 'jsonc-parser';
import { DataSource } from 'typeorm';

const cfg = parse(fs.readFileSync('./config/database.jsonc', 'utf-8'));
const env = process.env;

export default new DataSource({
    type: 'postgres',
    host: env.DB__HOST || cfg.host,
    port: env.DB__PORT ? parseInt(env.DB__PORT) : cfg.port,
    username: env.DB__USERNAME || cfg.username,
    password: env.DB__PASSWORD || cfg.password,
    database: env.DB__DATABASE || cfg.database,
    synchronize: env.DB__SYNCHRONIZE === 'true' || false,
    logging: env.DB__LOGGING === 'true' || false,
    entities: ['src/types/database/entities/*.ts'],
    migrations: ['src/types/database/migrations/*.ts'],
    subscribers: ['src/types/database/subscribers/*.ts'],
});
