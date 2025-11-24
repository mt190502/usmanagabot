import { BaseChannel, Guild, User } from 'discord.js';
import fs from 'fs';
import { globSync } from 'glob';
import jsonc from 'jsonc-parser';
import path, { basename } from 'path';

/**
 * Supported languages for localization files under src/localization.
 */
export enum SupportedLanguages {
    AUTO = 'auto',
    EN = 'en',
    TR = 'tr',
}

/**
 * Translator provides localized message lookup with static memory caching and guild-specific language support.
 *
 * Features:
 * - Static memory cache: All translations loaded once at startup for maximum performance
 * - Guild-specific languages: Each Discord server can have its own language preference
 * - Zero disk I/O during runtime: All queries served from memory
 * - Robust fallback mechanism: Multiple fallback layers for missing translations
 * - Backward compatible: Existing code continues to work without changes
 * - Dynamic placeholder replacement with Discord entity formatting
 *
 * Architecture:
 * - Translation cache: Map<Language, Map<FilePath, ParsedContent>>
 * - Guild language cache: Map<GuildId, Language> (reduces database queries)
 * - Initialization: Call `await Translator.getInstance().initialize()` at bot startup
 * - Query methods: `query()` for new code with guild support, `querySync()` for backward compatibility
 *
 * Use Translator.getInstance() to access the singleton.
 */
export class Translator {
    /**
     * Singleton instance reference.
     */
    private static instance: Translator | null = null;

    /**
     * Current language used when resolving localization keys.
     */
    private static current_language: SupportedLanguages = SupportedLanguages.EN;

    /**
     * Static translation cache: Map<Language, ParsedContent>
     * Loaded once at startup and never modified during runtime.
     */
    private static translation_cache: Map<string, Record<string, unknown>> = new Map();

    /**
     * Static guild language cache: Map<GuildId, Language>
     * Reduces database queries for guild language preferences.
     */
    private static guild_language_cache: Map<string, SupportedLanguages> = new Map();

    /**
     * Format a Discord entity as "name (id)".
     * @param {unknown} entity - Discord entity (Guild, User, or Channel) or plain object with name/id properties.
     * @returns {string} Formatted string in "name (id)" format.
     */
    private formatDiscordEntity(entity: BaseChannel | Guild | User): string {
        if (!entity) return 'Unknown';

        if (typeof entity === 'object' && entity !== null) {
            if (entity instanceof BaseChannel) {
                return `Channel (<#${entity.id}>)`;
            } else if (entity instanceof Guild) {
                return `${entity.name} (<@${entity.id}>)`;
            } else if (entity instanceof User) {
                return `${entity.username} (<@${entity.id}>)`;
            }
        }
        return String(entity);
    }

    /**
     * Initialize the translation cache by loading all localization files into memory.
     * Called once at startup.
     */
    private static initCache() {
        const languages = Object.values(SupportedLanguages);
        for (const lang of languages) {
            if (lang === SupportedLanguages.AUTO) continue;
            const dir = path.join(__dirname, `../localization/${lang}`);
            let lang_cache: Record<string, unknown> = {};
            for (const f of globSync(path.join(dir, '**/*.jsonc'))) {
                const content = jsonc.parse(fs.readFileSync(f, 'utf-8'));
                lang_cache = { ...lang_cache, ...content };
            }
            Translator.translation_cache.set(lang, lang_cache);
        }
    }

    /**
     * Resolve a nested key in a JSON object.
     * @param {Record<string, unknown>} obj - The object to search in.
     * @param {string} key - Dot-separated key path (e.g., 'ping.execute.measuring').
     * @returns {string | null} The resolved value or null if not found.
     */
    private resolveNestedKey(obj: unknown, key: string): string | null {
        const parts = key.split('.');
        let current: unknown = obj;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = (current as Record<string, unknown>)[part];
            } else {
                return null;
            }
        }

        return typeof current === 'string' ? current : null;
    }

    /**
     * Resolve a localization key and optionally apply replacements.
     * @param {string} caller - Category or command identifier for the localization file.
     * @param {string} key - Localization key to look up.
     * @param {Object} [replacements] - Optional replacements for placeholders in the localized string.
     * @returns {string} Localized string with replacements applied.
     */
    public querySync(caller: string, key: string, replacements?: { [key: string]: unknown }): string {
        let translation;
        const cache = Translator.translation_cache.get(Translator.current_language);
        const referrer = basename(
            new Error().stack?.match(/at\s.+\(?\/.*\/(commands\/.*)\)?/)?.[1].split(':')[0] ?? '',
        ).replace('.ts', '');
        const request =
            cache![caller] ??
            cache![referrer!] ??
            cache![referrer!.replace(/([A-Z])/g, '_$1').toLowerCase()];
        translation = this.resolveNestedKey(request, key) ?? key;
        if (translation === key) translation = this.resolveNestedKey(cache!, key) ?? key;

        if (replacements && Object.keys(replacements).length > 0) {
            for (const [k, v] of Object.entries(replacements)) {
                const formatted_value =
                    typeof v === 'object' && v !== null
                        ? this.formatDiscordEntity(v as BaseChannel | Guild | User)
                        : String(v);
                translation = translation.replace(new RegExp(`\\{${k}\\}`, 'g'), formatted_value);
            }
        }
        return translation;
    }

    /**
     * Update the current language for subsequent localization lookups.
     * Clears the file cache when language changes.
     * @param {SupportedLanguages} lang New language to set.
     */
    public set setLanguage(lang: SupportedLanguages) {
        if (lang.toUpperCase() in SupportedLanguages) {
            Translator.current_language = lang;
        }
    }

    /**
     * Obtain the Translator singleton instance.
     * @returns {Translator} Singleton instance.
     */
    public static getInstance(): Translator {
        if (!Translator.instance) {
            Translator.instance = new Translator();
            Translator.initCache();
        }
        return Translator.instance;
    }
}
