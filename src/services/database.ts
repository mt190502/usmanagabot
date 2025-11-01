import { glob } from 'glob';
import { DataSource } from 'typeorm';
import { Config, DatabaseConfig_t } from '@services/config';
import { Logger } from '@services/logger';

/**
 * Database service class responsible for initializing and exposing TypeORM DataSource.
 *
 * Responsibilities:
 * - Discover entity/migration/subscriber modules from src/types/database and initialize TypeORM DataSource.
 * - Expose the initialized DataSource for use by repositories and other services.
 * - Provide a singleton accessor to ensure a single DB connection per process.
 *
 * Note: Initialization errors are logged via the Logger singleton; this class does not throw during init.
 */
export class Database {
    /**
     * Singleton reference for the Database service.
     */
    private static instance: Database | null = null;

    /**
     * `Logger` singleton used for reporting initialization errors and other important events.
     * @static
     * @type {Logger}
     */
    private static logger: Logger = Logger.getInstance();

    /**
     * The currently loaded database configuration used to build the `DataSource`.
     * @readonly
     * @type {DatabaseConfig_t}
     */
    public readonly current_dbcfg: DatabaseConfig_t;

    /**
     * The TypeORM `DataSource` instance once initialization completes.
     * Will be `null` until `init()` successfully runs.
     * @type {(DataSource | null)}
     */
    public dataSource: DataSource | null = null;

    /**
     * Obtain the Database singleton. If not yet created, it constructs the object and
     * attempts to initialize the underlying TypeORM DataSource.
     *
     * @param {DatabaseConfig_t} [c_dbcfg] Optional override for the database configuration (useful for tests).
     * @returns {Promise<Database>} Promise resolving to the singleton Database instance.
     */
    public static async getInstance(c_dbcfg?: DatabaseConfig_t): Promise<Database> {
        Database.logger.send('debug', 'services.getInstance.call');
        Database.logger.send('debug', 'services.getInstance.check');
        if (!Database.instance) {
            Database.logger.send('debug', 'services.getInstance.not_exists');
            Database.logger.send('debug', 'services.getInstance.creating');
            Database.instance = new Database(c_dbcfg);
            Database.logger.send('debug', 'services.getInstance.created');
            Database.logger.send('debug', 'services.getInstance.awaiting_init');
            await Database.instance.init();
            Database.logger.send('debug', 'services.getInstance.initialized');
        }
        Database.logger.send('debug', 'services.getInstance.returning');
        return Database.instance;
    }

    /**
     * Initialize the TypeORM `DataSource`:
     * - Scans repository for entities, migrations, and subscribers.
     * - Constructs a `DataSource` using the loaded configuration and modules.
     * - Calls `dataSource.initialize()` and logs any errors encountered.
     *
     * @private
     * @async
     * @returns {Promise<void>} Resolves when initialization completes (or after logging on error).
     */
    private async init(): Promise<void> {
        Database.logger.send('debug', 'services.database.init.call');
        Database.logger.send('debug', 'services.database.init.discovering_entities');
        const entities = (await glob('src/types/database/entities/*.ts')).sort((a, b) => a.localeCompare(b));
        Database.logger.send('debug', 'services.database.init.discovered_entities', [entities.length]);
        Database.logger.send('debug', 'services.database.init.discovering_migrations');
        const migrations = (await glob('src/types/database/migrations/*.ts')).sort((a, b) => a.localeCompare(b));
        Database.logger.send('debug', 'services.database.init.discovered_migrations', [migrations.length]);
        Database.logger.send('debug', 'services.database.init.discovering_subscribers');
        const subscribers = (await glob('src/types/database/subscribers/*.ts')).sort((a, b) => a.localeCompare(b));
        Database.logger.send('debug', 'services.database.init.discovered_subscribers', [subscribers.length]);
        Database.logger.send('debug', 'services.database.init.datasource_creating', [this.current_dbcfg]);
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
            Database.logger.send('debug', 'services.database.init.datasource_creating');
            await this.dataSource.initialize();
            Database.logger.send('debug', 'services.database.init.datasource_created');
            Database.logger.send('info', 'services.database.init.success');
        } catch (error) {
            Database.logger.send('error', 'services.database.init.initialization_error', [
                error instanceof Error ? error.message : 'Unknown error',
            ]);
        }
        Database.logger.send('debug', 'services.database.init.end');
    }

    /**
     * Private constructor to enforce singleton usage.
     *
     * @param {DatabaseConfig_t} [c_dbcfg] Optional database configuration override.
     */
    private constructor(c_dbcfg?: DatabaseConfig_t) {
        Database.logger.send('debug', 'services.database.constructor.call');
        this.current_dbcfg = c_dbcfg || Config.getInstance().current_dbcfg;
        Database.logger.send('debug', 'services.database.constructor.end');
    }
}
