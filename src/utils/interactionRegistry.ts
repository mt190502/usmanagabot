import {
    BaseInteraction,
    InteractionResponse,
} from 'discord.js';

interface StoredInteractionResponse {
    response: InteractionResponse;
    timestamp: number;
    ttl: number;
}

/**
 * A static registry for temporarily storing `InteractionResponse` objects.
 *
 * This is primarily used by decorators to edit the original message response
 * from a different context, such as a button interaction handler. Responses are
 * stored with a Time-to-Live (TTL) and are automatically cleaned up.
 */
export class InteractionResponseRegistry {
    private static responses = new Map<string, StoredInteractionResponse>();
    private static cleanup_interval: NodeJS.Timeout | null = null;

    /**
     * Generates a unique key for an interaction response based on the command and user context.
     * @param {BaseInteraction} interaction The originating Discord interaction.
     * @param {string} command_name The name of the command.
     * @param {string} property_key The name of the decorated method (property key).
     * @returns {string} A unique key for the registry.
     */
    static generateKey(
        interaction: BaseInteraction,
        command_name: string,
        property_key: string
    ): string {
        return `${command_name}:${property_key}:${interaction.user.id}:${interaction.channelId}`;
    }

    /**
     * Stores an `InteractionResponse` in the registry with a specific TTL.
     * @param {string} key The unique key for the response.
     * @param {InteractionResponse} response The response object to store.
     * @param {number} [ttl=300000] The Time-to-Live for the stored response in milliseconds. Defaults to 5 minutes.
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
     * Retrieves a stored `InteractionResponse`. If the item has expired, it is removed.
     * @param {string} key The unique key for the response.
     * @returns {InteractionResponse | undefined} The stored response, or `undefined` if not found or expired.
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
     * Manually deletes an interaction response from the registry.
     * @param {string} key The unique key for the response to delete.
     */
    static delete(key: string): void {
        this.responses.delete(key);

        if (this.responses.size === 0 && this.cleanup_interval) {
            clearInterval(this.cleanup_interval);
            this.cleanup_interval = null;
        }
    }

    /**
     * Iterates through the registry and removes all expired responses.
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
     * Starts the automatic cleanup interval if it is not already running.
     * @private
     */
    private static startCleanupInterval(): void {
        this.cleanup_interval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    /**
     * Returns the current number of items in the registry. Useful for debugging.
     * @returns {number} The number of stored responses.
     */
    static size(): number {
        return this.responses.size;
    }

    /**
     * Clears all responses from the registry and stops the cleanup interval.
     * Useful for testing or shutting down.
     */
    static clear(): void {
        this.responses.clear();
        if (this.cleanup_interval) {
            clearInterval(this.cleanup_interval);
            this.cleanup_interval = null;
        }
    }
}