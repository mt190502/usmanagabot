# Localization Guide

This guide explains how the bot's localization (l10n) system works and how to add new languages or modify existing translations.

## Overview

The localization system is managed by the `Translator` service (`src/services/translator.ts`), which loads all translation files into memory at startup for fast access. It supports per-guild language settings and includes a robust fallback mechanism for missing translations.

Translations are stored in JSONC (`.jsonc`) files in the `src/localization` directory, organized by language and category.

## File Structure

The localization directory is structured as follows:

```bash
src/localization/
├── en-US/
│   ├── commands/
│   ├── events/
│   ├── services/
│   └── system/
└── tr/
    ├── commands/
    ├── events/
    ├── services/
    └── system/
```

* Each language has its own directory (e.g., `en-US`, `tr`).
* Within each language directory, translations are further divided into categories: `commands`, `events`, `services`, and `system`.

## Adding a New Language

1. **Add to `SupportedLanguages`:**
    Open `src/services/translator.ts` and add the new language to the `SupportedLanguages` enum. Use the locale codes from `discord.js`.

    ```typescript
    // src/services/translator.ts
    export enum SupportedLanguages {
        // ...
        FR = Locale.French, // Example
    }
    ```

2. **Create a New Directory:**
    Create a new directory in `src/localization` with the same name as the language code you added (e.g., `fr`).

3. **Copy and Translate Files:**
    Copy the contents of an existing language directory (e.g., `en-US`) into your new language directory and translate the values in each file.

## Managing Translations

Translations for a specific command, event, or service are stored in a corresponding `.jsonc` file. The file path mirrors the path of the source file.

For example, the translations for the `ping` command (`src/commands/core/ping.ts`) are located at `src/localization/[lang]/commands/core/ping.jsonc`.

### Example Translation File

Here is an example of a translation file for the `ping` command:

```jsonc
// src/localization/en-US/commands/core/ping.jsonc
{
    "ping": {
        "name": "ping",
        "pretty_name": "Ping",
        "description": "Measures the bot's response time.",
        "execute": {
            "measuring": "Measuring latency..."
        }
    }
}
```

### Using the Translator

Within a command or event, you can use the `t` helper function to get a translated string. This function is automatically available on the `BaseCommand` and `BaseEvent` classes.

```typescript
// Example from the ping command
export default class PingCommand extends BaseCommand {
    // ...
    public async execute(interaction: CommandInteraction): Promise<void> {
        // The key 'execute.measuring' is automatically looked up
        // within the 'ping' command's translation file.
        const msg = await interaction.reply(
            this.t.commands({ key: 'execute.measuring' })
        );
    }
}
```

### Placeholders

The translator supports placeholders, which are replaced with dynamic values at runtime.

```jsonc
// Example with a placeholder
"welcome_message": "Welcome to the server, {user}!"
```

```typescript
// Using the placeholder
this.t.system({
    key: 'welcome_message',
    replacements: { user: interaction.user.username }
});
