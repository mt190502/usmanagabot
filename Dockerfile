## Base Image
FROM oven/bun:alpine

## Set Working Directory
WORKDIR /app

## Copy Files
COPY . /app/

## Install Dependencies
RUN bun install

## Move Dummy Config
RUN mv config/bot-example.jsonc config/bot.jsonc && \
    mv config/database-example.jsonc config/database.jsonc

## Enjoy
CMD ["bun", "run", "start"]