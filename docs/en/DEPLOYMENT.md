# Deployment Guide

This guide explains how to deploy the UsmanAga bot to a production environment using Docker and Docker Compose.

## Prerequisites

* A server with Docker and Docker Compose installed.
* A Git client installed on the server.
* A production-ready PostgreSQL database. While you can use the one from the `docker-compose.yml` for development, it's recommended to use a managed database service or a properly configured PostgreSQL server for production.

## Deployment Steps

1. **Clone the Repository:**
    Clone the repository to your server:

    ```bash
    git clone https://github.com/mt190502/usmanagabot.git
    cd usmanagabot
    ```

2. **Configure Environment Variables:**
    The recommended way to configure the bot for production is through environment variables. The `docker-compose.yml` file is set up to pass environment variables to the bot and database services.

    Create a `.envrc` file in the root of the project:

    ```bash
    cp .envrc.example .envrc
    ```

    Edit the `.envrc` file and provide the following values:

    ```bash
    # Bot Configuration
    BOT__APP_ID=your_discord_app_id
    BOT__TOKEN=your_discord_bot_token
    BOT__MANAGEMENT__CHANNEL_ID=your_management_channel_id
    BOT__MANAGEMENT__GUILD_ID=your_management_guild_id
    BOT__MANAGEMENT__USER_ID=your_management_user_id

    # Database Configuration
    DB__HOST=your_database_host
    DB__PORT=your_database_port
    DB__USERNAME=your_database_username
    DB__PASSWORD=your_database_password
    DB__DATABASE=your_database_name
    ```

    **Note:** The double underscore `__` is used to separate nested configuration keys. For example, `BOT__MANAGEMENT__CHANNEL_ID` corresponds to `management.channel_id` in the `bot.jsonc` file.

3. **Build and Run with Docker Compose:**
    The provided `docker-compose.yml` file is configured to build the bot's Docker image and run it as a service, along with a PostgreSQL database.

    To build and start the services, run:

    ```bash
    docker-compose up --build -d
    ```

    * `--build`: Forces a rebuild of the Docker image, which is useful when you've made changes to the code.
    * `-d`: Runs the services in detached mode (in the background).

4. **Run Database Migrations:**
    After the services have started, you need to run the database migrations to set up the database schema.

    You can do this by executing the migration command inside the running bot container:

    ```bash
    docker-compose exec bot bun run typeorm:migration:run
    ```

## Updating the Bot

To update the bot with the latest changes from the repository:

1. **Pull the latest code:**

    ```bash
    git pull
    ```

2. **Rebuild and restart the services:**

    ```bash
    docker-compose up --build -d
    ```

3. **Run any new migrations:**

    ```bash
    docker-compose exec bot bun run typeorm:migration:run
    ```

## Production Considerations

* **Database:** For a production deployment, it is highly recommended to use a managed database service (e.g., Amazon RDS, Google Cloud SQL) or a properly secured and backed-up PostgreSQL server instead of the one provided in the `docker-compose.yml`.
* **Logging:** By default, the bot logs to the console, which can be viewed with `docker-compose logs -f bot`. For a production setup, you may want to configure a more robust logging solution, such as sending logs to a file or a log management service.
