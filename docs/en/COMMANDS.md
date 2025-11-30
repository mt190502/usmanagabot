# Creating Commands

This guide explains how to create new application commands for the bot. The command system is designed to be modular and flexible, supporting both simple and complex commands with customizable, per-guild settings.

## Command Structure

All commands are located in the `src/commands` directory and are organized into subdirectories based on their category (e.g., `core`, `admin`, `misc`). Each command is a class that extends either `BaseCommand` or `CustomizableCommand`.

### `BaseCommand`

The `BaseCommand` class is the foundation for all commands. It provides the core properties and methods needed for a command to function, including:

* `name`: The unique name of the command.
* `description`: A brief description of what the command does.
* `execute(interaction)`: The main execution logic for the command.

### `CustomizableCommand`

The `CustomizableCommand` class extends `BaseCommand` and is used for commands that require per-guild settings. It adds functionality for:

* `prepareCommandData(guild_id)`: Preparing command-specific data for a guild (e.g., creating default database entries).
* `settingsUI(interaction)`: Rendering a settings user interface for the command.

## Creating a Simple Command

Here is an example of a simple command (`ping`) that extends `BaseCommand`:

```typescript
// src/commands/core/ping.ts

import { CommandInteraction } from 'discord.js';
import { BaseCommand } from '../../types/structure/command';

export default class PingCommand extends BaseCommand {
    constructor() {
        super({ name: 'ping' });
    }

    public async execute(interaction: CommandInteraction): Promise<void> {
        const msg = await interaction.reply('Measuring latency...');
        const latency = msg.createdTimestamp - interaction.createdTimestamp;
        await msg.edit(`Pong! Latency is ${latency}ms.`);
    }
}
```

**To create a new simple command:**

1. Create a new TypeScript file in the appropriate subdirectory of `src/commands`.
2. Create a class that extends `BaseCommand`.
3. In the `constructor`, call `super()` with the command's options (at a minimum, the `name`). The `description` and other properties are automatically localized.
4. Implement the `execute` method with your command's logic.

## Creating a More Complex Command

For commands that require more advanced features like slash command options, context menus, or confirmation prompts, you can use the builders and decorators provided.

Here is an excerpt from the `purge` command, which demonstrates several advanced features:

```typescript
// src/commands/admin/purge.ts

import {
    ApplicationCommandType,
    ButtonInteraction,
    CommandInteraction,
    ContextMenuCommandBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import { CommandQuestionPrompt } from '../../types/decorator/commandquestionprompt';
import { BaseCommand } from '../../types/structure/command';

export default class PurgeCommand extends BaseCommand {
    constructor() {
        super({ name: 'purge', is_admin_command: true });

        // Add a string option to the slash command
        (this.base_cmd_data as SlashCommandBuilder)
            .addStringOption((o) =>
                o.setName('message_id').setDescription('The message to purge up to.')
            );

        // Create a context menu command
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setType(ApplicationCommandType.Message);
    }

    @CommandQuestionPrompt({ message: 'Are you sure you want to purge messages?' })
    public async execute(interaction: ButtonInteraction | CommandInteraction): Promise<void> {
        // ... execution logic ...
    }
}
```

### Key Features

* **Slash Command Options:** Use the `SlashCommandBuilder` in `this.base_cmd_data` to add options to your command.
* **Context Menus:** Create a `ContextMenuCommandBuilder` and add it to the command's data using `this.push_cmd_data`.
* **Confirmation Prompts:** Use the `@CommandQuestionPrompt` decorator on the `execute` method to require user confirmation before running the command. The `execute` method will be called once for the initial interaction and a second time if the user confirms.

## Localization

The command system is fully integrated with the `Translator` service. When you define a command's properties in the `constructor`, the `pretty_name`, `description`, and `help` fields are automatically translated using keys from your localization files.

For example, `super({ name: 'ping', description: 'description' })` will use the `ping.description` key from the command's localization file.
