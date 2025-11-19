import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ColorResolvable,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';

/**
 * Paginator module.
 * Manages paginated embeds with navigation buttons and select menus.
 */

/**
 * Pagination item state interface.
 * Tracks current page and configuration for pagination.
 *
 * @property {number} current_page - The current page number.
 * @property {object} config - Configuration for pagination.
 * @property {string} config.title - Title of the embed.
 * @property {ColorResolvable} config.color - Color of the embed.
 * @property {Array} config.items - Array of items to paginate.
 * @property {number} config.items_per_page - Number of items per page.
 * @property {string} [config.select_menu_placeholder] - Placeholder text for the select menu.
 */
interface pageItem {
    current_page: number;
    config: {
        title: string;
        color: ColorResolvable;
        items: { name: string; pretty_name: string; description: string; namespace: 'command' | 'settings' }[];
        items_per_page: number;
        select_menu_placeholder?: string;
    };
}

/**
 * View item state interface.
 * Used for viewing detailed information about a specific item.
 *
 * @property {string} title - Title of the embed.
 * @property {ColorResolvable} color - Color of the embed.
 * @property {string} description - Description of the item.
 */
interface viewItem {
    color: ColorResolvable;
    title: string;
    description: string;
}

/**
 * Paginator class.
 * Manages paginated embeds with navigation buttons and select menus.
 */
export class Paginator {
    // ============================ HEADER ============================ //
    /**
     * Singleton instance reference for the Paginator class. Set during getInstance().
     */
    private static instance: Paginator | null = null;

    /**
     * Map to store pagination states for different guilds, users, and commands.
     * @static
     * @type {Map<string, pageItem>}
     */
    private static page_states: Map<string, pageItem> = new Map();

    /**
     * Generates a unique state key for a guild, user, and command combination.
     *
     * @param {string} guild_id - The ID of the guild.
     * @param {string} user_id - The ID of the user.
     * @param {string} command_name - The name of the command.
     * @returns {string} Unique state key.
     */
    private getStateKey(guild_id: string, user_id: string, command_name: string): string {
        return `${guild_id}:${user_id}:${command_name}`;
    }

    /**
     * Builds the paginated embed response with navigation buttons and select menu.
     *
     * @param {pageItem} pagination_state - The current pagination state.
     * @param {string} command_name - The name of the command.
     * @returns {object} Object containing embeds and components for the response.
     */
    private buildPageResponse(
        pagination_state: pageItem,
        command_name: string,
    ): {
        embeds: EmbedBuilder[];
        components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
    } {
        const { current_page, config } = pagination_state;
        const { title, color, items_per_page, select_menu_placeholder } = config;

        const post = new EmbedBuilder();
        const button_row = new ActionRowBuilder<ButtonBuilder>();
        const prev = new ButtonBuilder()
            .setCustomId(`page:${command_name}:prev`)
            .setEmoji('⬅️')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary);
        const next = new ButtonBuilder()
            .setCustomId(`page:${command_name}:next`)
            .setEmoji('➡️')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary);
        const string_select_menu = new StringSelectMenuBuilder()
            .setCustomId(`command:${command_name}:pageitem`)
            .setPlaceholder(select_menu_placeholder || 'Select an item from the list');

        post.setTitle(title).setColor(color);
        let description = '';

        const total_pages = Math.ceil(config.items.length / items_per_page);
        prev.setDisabled(current_page === 1);
        next.setDisabled(current_page >= total_pages);
        button_row.addComponents(prev, next);

        const start_index = (current_page - 1) * items_per_page;
        const end_index = current_page * items_per_page;
        const page_items = config.items.slice(start_index, end_index);

        for (const item of page_items) {
            description += `**${item.pretty_name}**\n${item.description}\n\n`;
            string_select_menu.addOptions({
                label: item.pretty_name,
                description: item.description?.substring(0, 50) || 'No description provided.',
                value:
                    item.namespace === 'settings'
                        ? `settings:${item.name}`
                        : `command:${command_name}:pageitem:${item.name}`,
            });
        }
        post.setDescription(description.trim());
        post.setFooter({ text: `Page ${current_page} of ${total_pages}` });

        return {
            embeds: [post],
            components: [
                ...(config.items.length > items_per_page ? [button_row] : []),
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(string_select_menu),
            ],
        };
    }

    /**
     * Generates the initial paginated embed response.
     *
     * @param {string} guild_id - The ID of the guild.
     * @param {string} user_id - The ID of the user.
     * @param {string} command_name - The name of the command.
     * @param {object} o - Configuration for pagination.
     * @param {string} o.title - Title of the embed.
     * @param {ColorResolvable} o.color - Color of the embed.
     * @param {Array} o.items - Array of items to paginate.
     * @param {number} [o.items_per_page=5] - Number of items per page.
     * @param {string} [o.select_menu_placeholder] - Placeholder text for the select menu.
     * @returns {object} Object containing embeds and components for the response.
     */
    public async generatePage(
        guild_id: string,
        user_id: string,
        command_name: string,
        o: pageItem['config'],
    ): Promise<{
        embeds: EmbedBuilder[];
        components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
    }> {
        const items_per_page = o.items_per_page ?? 5;
        const state_key = this.getStateKey(guild_id, user_id, command_name);

        let pagination_state = Paginator.page_states.get(state_key);
        if (!pagination_state) {
            pagination_state = {
                current_page: 1,
                config: {
                    title: o.title,
                    color: o.color,
                    items: o.items,
                    items_per_page,
                    select_menu_placeholder: o.select_menu_placeholder,
                },
            };
            Paginator.page_states.set(state_key, pagination_state);
        } else {
            pagination_state.config = {
                title: o.title,
                color: o.color,
                items: o.items,
                items_per_page,
                select_menu_placeholder: o.select_menu_placeholder,
            };
        }

        return this.buildPageResponse(pagination_state, command_name);
    }

    public async viewPage(
        guild_id: string,
        user_id: string,
        command_name: string,
        o: viewItem,
    ): Promise<{
        embeds: EmbedBuilder[];
        components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
    }> {
        const { title, color, description } = o;
        const post = new EmbedBuilder();
        post.setTitle(title).setColor(color);
        post.setDescription(description.replaceAll(/^[ ]{16}/gm, '').trim());
        const back = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`page:${command_name}:back`)
                .setEmoji('⬅️')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
        );
        return {
            embeds: [post],
            components: [back],
        };
    }

    /**
     * Generates the previous page of the paginated embed.
     *
     * @param {string} guild_id - The ID of the guild.
     * @param {string} user_id - The ID of the user.
     * @param {string} command_name - The name of the command.
     * @returns {object} Object containing embeds and components for the response.
     */
    public async previousPage(
        guild_id: string,
        user_id: string,
        command_name: string,
    ): Promise<{
        embeds: EmbedBuilder[];
        components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
    }> {
        const state_key = this.getStateKey(guild_id, user_id, command_name);
        const pagination_state = Paginator.page_states.get(state_key);
        if (!pagination_state) return { embeds: [], components: [] };
        if (pagination_state.current_page > 1) {
            pagination_state.current_page--;
        }
        return this.buildPageResponse(pagination_state, command_name);
    }

    /**
     * Generates the next page of the paginated embed.
     *
     * @param {string} guild_id - The ID of the guild.
     * @param {string} user_id - The ID of the user.
     * @param {string} command_name - The name of the command.
     * @returns {object} Object containing embeds and components for the response.
     */
    public async nextPage(
        guild_id: string,
        user_id: string,
        command_name: string,
    ): Promise<{
        embeds: EmbedBuilder[];
        components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
    }> {
        const state_key = this.getStateKey(guild_id, user_id, command_name);
        const pagination_state = Paginator.page_states.get(state_key);
        if (!pagination_state) return { embeds: [], components: [] };
        const total_pages = Math.ceil(pagination_state.config.items.length / pagination_state.config.items_per_page);
        if (pagination_state.current_page < total_pages) {
            pagination_state.current_page++;
        }
        return this.buildPageResponse(pagination_state, command_name);
    }

    /**
     * Generates the back view of the paginated embed.
     *
     * @param {string} guild_id - The ID of the guild.
     * @param {string} user_id - The ID of the user.
     * @param {string} command_name - The name of the command.
     * @returns {object} Object containing embeds and components for the response.
     */
    public async backPage(
        guild_id: string,
        user_id: string,
        command_name: string,
    ): Promise<{
        embeds: EmbedBuilder[];
        components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
    }> {
        const state_key = this.getStateKey(guild_id, user_id, command_name);
        const pagination_state = Paginator.page_states.get(state_key);
        if (!pagination_state) return { embeds: [], components: [] };
        return this.buildPageResponse(pagination_state, command_name);
    }

    /**
     * Return the singleton Paginator instance, creating it if necessary.
     *
     * @returns {Paginator} Singleton instance of Paginator.
     */
    public static getInstance(): Paginator {
        if (!Paginator.instance) {
            Paginator.instance = new Paginator();
        }
        return Paginator.instance;
    }
}
