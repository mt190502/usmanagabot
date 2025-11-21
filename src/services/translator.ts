import { BaseChannel, Guild, User } from 'discord.js';
import fs from 'fs';
import jsonc from 'jsonc-parser';
import path from 'path';
import { LogLevels } from './logger';

/**
 * Supported languages for localization files under src/localization.
 */
export enum SupportedLanguages {
    EN = 'en',
    TR = 'tr',
}

/**
 * Logger provides localized, leveled logging with formatted output.
 *
 * Features:
 * - Language-aware message lookup using jsonc files.
 * - Level filtering via a selected minimum threshold.
 * - Message formatting with timestamp, file and line metadata.
 *
 * Use Logger.getInstance() to access the singleton.
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
     * Resolve a localization key and optionally apply numbered replacements.
     * @param {string} mode Localization category (e.g., 'debug', 'error', 'commands')
     * @param {string} key Localization key (e.g., 'events.index.loading').
     * @param {(string | number | unknown)[]} [replacements] Optional values to replace {0}, {1}, ... in the template.
     * @returns {string} Localized and formatted message.
     */
    public querySync<T extends 'commands' | 'logger'>(
        mode: T extends 'logger' ? keyof typeof LogLevels : 'commands',
        key: string,
        replacements?: { [key: string]: unknown },
    ): string {
        const file = jsonc.parse(
            fs.readFileSync(path.join(__dirname, `../localization/${Translator.current_language}.jsonc`), 'utf-8'),
        );
        let translation: string;

        if (mode === 'commands') {
            translation = file['commands'][key] || '<missing> ' + key;
        } else {
            translation = file['logging'][mode][key] || '<missing translation> ' + key;
        }
        if (replacements && Object.keys(replacements).length > 0) {
            for (const [k, v] of Object.entries(replacements)) {
                const formatted_value =
                    typeof v === 'object' && v !== null
                        ? this.formatDiscordEntity(v as BaseChannel | Guild | User)
                        : String(v);
                translation = translation.replace(`{${k}}`, formatted_value);
            }
        }
        return translation;
    }

    /**
     * Update the current language for subsequent localization lookups.
     * @param {SupportedLanguages} lang New language to set.
     */
    public set setLanguage(lang: SupportedLanguages) {
        if (lang.toUpperCase() in SupportedLanguages) Translator.current_language = lang;
    }

    /**
     * Obtain the Translator singleton instance.
     * @returns {Translator} Singleton instance.
     */
    public static getInstance(): Translator {
        if (!Translator.instance) Translator.instance = new Translator();
        return Translator.instance;
    }
}
