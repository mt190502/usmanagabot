# Creating Events

This guide explains how to create new event handlers for the bot. The event system allows you to listen and react to events from the Discord.js client, such as when the bot is ready, when a new message is sent, or when a user interacts with a command.

## Event Structure

All event handlers are located in the `src/events` directory. Each event handler is a class that extends the `BaseEvent` class.

### `BaseEvent`

The `BaseEvent` class provides the core structure for all event handlers. It includes the following properties:

* `type`: The type of the client event this handler is for (e.g., `Events.ClientReady`, `Events.InteractionCreate`).
* `once`: If `true`, the event will be handled only once.
* `execute(...args)`: The main execution logic for the event handler.

## Creating a Simple Event Handler

Here is an example of a simple event handler (`ready`) that runs once when the bot is ready:

```typescript
// src/events/ready.ts

import { BaseEvent } from '@src/types/structure/event';
import { Client, Events } from 'discord.js';

export default class ReadyEvent extends BaseEvent<Events.ClientReady> {
    constructor() {
        super({ enabled: true, type: Events.ClientReady, once: true });
    }

    public async execute(client: Client<true>): Promise<void> {
        this.log.send('events', 'ready', 'log', 'success', { name: client.user.tag });
    }
}
```

**To create a new event handler:**

1. Create a new TypeScript file in the `src/events` directory.
2. Create a class that extends `BaseEvent`, specifying the event type from `discord.js`'s `Events` enum as the generic type.
3. In the `constructor`, call `super()` with the event's options, including the `type` and whether it should run `once`.
4. Implement the `execute` method with your event handling logic. The arguments for this method will match the arguments for the corresponding event in Discord.js.

## The Interaction Create Event

The `interactionCreate` event, located in `src/events/interaction.ts`, is a more complex example that acts as the central hub for all command and component interactions.

### Key Responsibilities

* **Command Routing:** It determines which command was invoked and executes it.
* **Cooldown Management:** It enforces cooldowns to prevent users from spamming commands.
* **Component Handling:** It delegates interactions from buttons, select menus, and modals to the appropriate command or handler.

When a user interacts with a component (like a button), the `interactionCreate` event uses a `customId` to route the interaction. The `customId` follows a `namespace:command_name:arg1:arg2...` format, which allows for a flexible and powerful way to handle complex interactions.
