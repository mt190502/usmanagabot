# Project Structure

This document provides a detailed overview of the project's directory structure, explaining the purpose of each file and folder.

```bash
.
├── config/
│   ├── bot-example.jsonc
│   └── database-example.jsonc
├── docs/
│   ├── en/
│   └── tr/
├── scripts/
│   └── generate_language_keys.js
├── src/
│   ├── commands/
│   ├── events/
│   ├── localization/
│   ├── services/
│   ├── types/
│   └── utils/
├── .dockerignore
├── .envrc.example
├── .gitignore
├── .prettierrc.json
├── bun.lock
├── docker-compose.yml
├── Dockerfile
├── eslint.config.mjs
├── flake.nix
├── LICENSE
├── package.json
├── shell.nix
├── tsconfig.json
└── typeorm.config.ts
```

## Root Directory

* `config/`: Contains example configuration files.
  * `bot-example.jsonc`: Example configuration for the bot.
  * `database-example.jsonc`: Example configuration for the database.
* `docs/`: Contains the project documentation.
  * `en/`: English documentation.
  * `tr/`: Turkish documentation.
* `scripts/`: Contains utility scripts for the project.
  * `generate_language_keys.js`: A script for generating keys.
* `src/`: The main source code of the application.
* `.dockerignore`: Specifies files and directories to ignore when building a Docker image.
* `.envrc.example`: Example environment variables file.
* `.gitignore`: Specifies files and directories to be ignored by Git.
* `.prettierrc.json`: Configuration file for Prettier.
* `bun.lock`: The lockfile for Bun, ensuring consistent dependencies.
* `docker-compose.yml`: Defines the services, networks, and volumes for a Docker application.
* `Dockerfile`: A script containing a series of instructions to build a Docker image.
* `eslint.config.mjs`: Configuration file for ESLint.
* `flake.nix` / `shell.nix`: Files for the Nix package manager, defining a reproducible development environment.
* `LICENSE`: The project's license file.
* `package.json`: Defines the project's metadata, dependencies, and scripts.
* `tsconfig.json`: The configuration file for the TypeScript compiler.
* `typeorm.config.ts`: The configuration file for TypeORM.

## `src/` Directory

* `commands/`: Contains all the bot's commands, organized into subdirectories by category.
  * `index.ts`: The command loader, which dynamically loads all commands.
* `events/`: Contains all the bot's event handlers.
  * `index.ts`: The event loader, which dynamically loads all event handlers.
* `localization/`: Contains the localization files for different languages.
* `services/`: Contains the core services of the bot.
  * `client.ts`: Initializes and manages the Discord.js client.
  * `config.ts`: Manages the bot's configuration.
  * `database.ts`: Manages the database connection.
  * `logger.ts`: A custom logger for the bot.
  * `translator.ts`: Manages the localization of the bot.
* `types/`: Contains TypeScript type definitions, database entities, and other structural types.
  * `database/`: Contains all database-related types.
    * `entities/`: TypeORM entity definitions.
    * `migrations/`: Database migration scripts.
    * `subscribers/`: TypeORM event subscribers.
  * `decorator/`: Contains custom decorators.
  * `structure/`: Contains the basic structures for commands, events, etc.
* `utils/`: Contains utility functions used throughout the application.
