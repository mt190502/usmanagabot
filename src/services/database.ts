import { glob } from 'glob';
import { DataSource } from 'typeorm';
import { Config, DatabaseConfig_t } from './config';
import { Logger } from './logger';

/**
 * Database service module.
 * This module is responsible for managing database connections and operations.
 * Currently, it serves as a placeholder for future database-related functionalities.
 */
export class Database {
    private static instance: Database | null = null;
    private static logger = Logger.getInstance();
    public readonly current_dbcfg: DatabaseConfig_t;
    public dataSource: DataSource | null = null;

    /**
     * Initializes the DatabaseService singleton instance.
     * @param {DatabaseConfig_t} c_dbcfg Optional database configuration object.
     * @returns An instance of DatabaseService with the initialized DataSource.
     */
    public static async getInstance(c_dbcfg?: DatabaseConfig_t): Promise<Database> {
        if (!Database.instance) {
            Database.instance = new Database(c_dbcfg);
            await Database.instance.init();
        }
        return Database.instance;
    }

    /**
     * Initializes the database connection using TypeORM.
     * This method sets up the DataSource with the provided configuration
     * and connects to the database.
     * @throws Error if there is an issue initializing the database connection.
     */
    private async init() {
        const entities = (await glob('src/models/entities/*.ts')).sort((a, b) => a.localeCompare(b));
        const migrations = (await glob('src/models/migrations/*.ts')).sort((a, b) => a.localeCompare(b));
        const subscribers = (await glob('src/models/subscribers/*.ts')).sort((a, b) => a.localeCompare(b));
        this.dataSource = new DataSource({
            type: 'postgres',
            host: this.current_dbcfg.host,
            port: this.current_dbcfg.port,
            username: this.current_dbcfg.username,
            password: this.current_dbcfg.password,
            database: this.current_dbcfg.database,
            synchronize: this.current_dbcfg.synchronize,
            logging: this.current_dbcfg.logging,
            entities,
            migrations,
            subscribers,
        });
        try {
            await this.dataSource.initialize();
        } catch (error) {
            Database.logger.send('error', 'services.database.initialization_error', [error]);
        }
    }

    /**
     * Creates a new instance of DatabaseService with the provided configuration.
     * @param c_dbcfg Optional database configuration object.
     */
    private constructor(c_dbcfg?: DatabaseConfig_t) {
        this.current_dbcfg = c_dbcfg || Config.getInstance().current_dbcfg;
    }
}
