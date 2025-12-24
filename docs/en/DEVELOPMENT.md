# Development Guide

This guide will walk you through the process of setting up the development environment, configuring the bot, and running it on your local machine.

## Prerequisites

* [Bun](https://bun.sh/)
* [Node.js](https://nodejs.org/en/) (for some scripts)
* [Git](https://git-scm.com/)
* [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) (for the database)

## Setup

1. **Clone the repository:**

    ```bash
    git clone https://github.com/LibreTurks/usmanagabot.git
    cd usmanagabot
    ```

2. **Install dependencies:**

    ```bash
    bun install
    ```

3. **Set up the database:**
    The project uses a PostgreSQL database, which can be easily run using Docker.

    ```bash
    docker-compose up -d
    ```

## Configuration

1. **Bot Configuration:**
    Create a `bot.jsonc` file in the `config` directory by copying the example file:

    ```bash
    cp config/bot-example.jsonc config/bot.jsonc
    ```

    Edit `config/bot.jsonc` and fill in the required fields:
    * `app_id`: Your Discord application ID.
    * `token`: Your Discord bot token.
    * `management`: IDs for a guild, channel, and user for bot management purposes.

2. **Database Configuration:**
    Create a `database.jsonc` file in the `config` directory:

    ```bash
    cp config/database-example.jsonc config/database.jsonc
    ```

    The default values in `database.jsonc` are configured to work with the provided `docker-compose.yml`. You shouldn't need to change them unless you are using a different database setup.

## Running the Bot

Once you have completed the setup and configuration, you can start the bot with the following command:

```bash
bun start
```

## Scripts

The `package.json` file contains several useful scripts for development:

* `eslint`: Lint the codebase for errors.
* `eslint:fix`: Automatically fix linting errors.
* `prettier`: Check the formatting of the codebase.
* `prettier:fix`: Automatically fix formatting issues.
* `typeorm:migration:create`: Create a new database migration.
* `typeorm:migration:generate`: Generate a new migration from your entities.
* `typeorm:migration:run`: Run all pending migrations.
* `typeorm:migration:revert`: Revert the last executed migration.
