# Database Guide

This guide provides an overview of the database setup, how to work with entities, and how to manage database migrations.

## Database Setup

The project uses [TypeORM](https://typeorm.io/) to interact with a [PostgreSQL](https://www.postgresql.org/) database. The database connection is configured in `typeorm.config.ts`, and the application's database service is managed by `src/services/database.ts`.

For local development, a PostgreSQL database can be easily run using the provided `docker-compose.yml` file:

```bash
docker-compose up -d
```

## Entities

Database entities are defined as classes in the `src/types/database/entities` directory. These classes map to database tables and their properties map to table columns.

Here is an example of the `Users` entity:

```typescript
// src/types/database/entities/users.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class Users {
    @PrimaryColumn('bigint')
    uid: bigint;

    @Column('varchar')
    name: string;
}
```

To create a new entity:

1. Create a new file in `src/types/database/entities`.
2. Define a class and decorate it with `@Entity()`.
3. Add properties to the class and decorate them with `@PrimaryColumn()`, `@Column()`, `@OneToMany()`, `@ManyToOne()`, etc., to define the table's structure and relationships.

## Accessing the Database

Within a command or service, you can access the database through the `db` getter, which provides an instance of the `DatabaseManager`.

```typescript
// Example of finding a user in a command
import { Users } from '@src/types/database/entities/users';

// ... inside a command's execute method ...
const user = await this.db.findOne(Users, { where: { uid: interaction.user.id } });
```

## Migrations

Database migrations are used to keep the database schema in sync with your entities. Migrations are stored in the `src/types/database/migrations` directory.

The project includes several npm scripts to help you manage migrations:

* **`bun run typeorm:migration:create`**: Creates a new, empty migration file. You can then add your SQL queries to the `up` and `down` methods.

* **`bun run typeorm:migration:generate`**: Automatically generates a new migration file with the SQL statements needed to sync the database with your entities. This is the recommended way to create migrations.

    **Example:**
    After adding a new entity or modifying an existing one, run:

    ```bash
    bun run typeorm:migration:generate -- -n MyNewMigration
    ```

* **`bun run typeorm:migration:run`**: Executes all pending migrations, applying the changes to the database.

* **`bun run typeorm:migration:revert`**: Reverts the last executed migration, undoing the changes.
