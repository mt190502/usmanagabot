export interface DatabaseConfiguration_t {
    driver: 'mysql' | 'mariadb' | 'postgres';
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    logging: boolean;
}
