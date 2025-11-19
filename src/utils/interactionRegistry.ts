import {
    Interaction,
    InteractionResponse,
    ButtonInteraction,
    ContextMenuCommandInteraction,
    StringSelectMenuInteraction
} from 'discord.js';

interface StoredInteractionResponse {
    response: InteractionResponse;
    timestamp: number;
    ttl: number;
}

/**
 * Centralized registry for storing interaction responses to enable proper editing
 * of original messages when handling button interactions in decorators.
 */
export class InteractionResponseRegistry {
    private static responses = new Map<string, StoredInteractionResponse>();
    private static cleanup_interval: NodeJS.Timeout | null = null;

    /**
     * Generates a unique key for storing interaction responses
     * @param interaction The Discord interaction
     * @param command_name The name of the command
     * @param property_key The method name being decorated
     * @returns A unique string key
     */
    static generateKey(
        interaction: ContextMenuCommandInteraction | StringSelectMenuInteraction | ButtonInteraction | Interaction,
        command_name: string,
        property_key: string
    ): string {
        return `${command_name}:${property_key}:${interaction.user.id}:${interaction.channelId}`;
    }

    /**
     * Stores an interaction response for later retrieval
     * @param key Unique identifier for the response
     * @param response The InteractionResponse to store
     * @param ttl Time to live in milliseconds (default: 5 minutes)
     */
    static store(key: string, response: InteractionResponse, ttl: number = 300000): void {
        this.responses.set(key, {
            response,
            timestamp: Date.now(),
            ttl
        });

        if (!this.cleanup_interval) {
            this.startCleanupInterval();
        }
    }

    /**
     * Retrieves a stored interaction response
     * @param key The unique identifier
     * @returns The stored InteractionResponse or undefined if not found/expired
     */
    static get(key: string): InteractionResponse | undefined {
        const stored = this.responses.get(key);

        if (!stored) {
            return undefined;
        }

        if (Date.now() - stored.timestamp > stored.ttl) {
            this.responses.delete(key);
            return undefined;
        }

        return stored.response;
    }

    /**
     * Removes a stored interaction response
     * @param key The unique identifier
     */
    static delete(key: string): void {
        this.responses.delete(key);

        if (this.responses.size === 0 && this.cleanup_interval) {
            clearInterval(this.cleanup_interval);
            this.cleanup_interval = null;
        }
    }

    /**
     * Removes all expired interaction responses
     */
    static cleanup(): void {
        const now = Date.now();
        const expired_keys: string[] = [];

        for (const [key, stored] of this.responses.entries()) {
            if (now - stored.timestamp > stored.ttl) {
                expired_keys.push(key);
            }
        }

        for (const key of expired_keys) {
            this.responses.delete(key);
        }

        // Stop cleanup interval if no responses remain
        if (this.responses.size === 0 && this.cleanup_interval) {
            clearInterval(this.cleanup_interval);
            this.cleanup_interval = null;
        }
    }

    /**
     * Starts the automatic cleanup interval
     */
    private static startCleanupInterval(): void {
        this.cleanup_interval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    /**
     * Gets the current number of stored responses (for debugging)
     */
    static size(): number {
        return this.responses.size;
    }

    /**
     * Clears all stored responses (for cleanup/testing)
     */
    static clear(): void {
        this.responses.clear();
        if (this.cleanup_interval) {
            clearInterval(this.cleanup_interval);
            this.cleanup_interval = null;
        }
    }
}