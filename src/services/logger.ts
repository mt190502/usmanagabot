import dayjs from 'dayjs';
import { BaseChannel, Guild, User } from 'discord.js';
import fs from 'fs';
import jsonc from 'jsonc-parser';
import path from 'path';

/**
 * Log levels used by the Logger.
 * Values are ordered by severity and used for filtering.
 */
export enum LogLevels {
    off = 0,
    log = 1,
    info = 2,
    warn = 4,
    error = 8,
    debug = 16,
}

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
export class Logger {
    /**
     * Singleton instance reference.
     */
    private static instance: Logger | null = null;

    /**
     * Current language used when resolving localization keys.
     */
    private static current_language: SupportedLanguages = SupportedLanguages.EN;

    /**
     * Currently selected minimum log level. Messages with a numerically greater
     * value than this threshold are filtered out.
     */
    private static selected_log_level: LogLevels =
        process.env.NODE_ENV === 'production' ? LogLevels.error : LogLevels.debug;

    /**
     * Determine caller filename and line from a stack trace.
     * @returns {{filename: string, linenumber: string}} The caller's source filename and line number.
     */
    private getCallerInfo(): { filename: string; linenumber: string } {
        const stack_lines = new Error().stack?.split('\n') ?? [];
        let caller_line = '';
        for (let i = 3; i < stack_lines.length; i++) {
            if (stack_lines[i] && !stack_lines[i].includes('logger.ts')) {
                caller_line = stack_lines[i];
                break;
            }
        }
        const match = caller_line.match(/(?:at .*?\(?|at\s+)(?:(?:file:\/\/)?([^()]+?)|([^(/]+)):(\d+):\d+\)?$/);
        const filename = match ? ((match[1] || match[2]).match(/src\/(.+)/)![1] ?? 'unknown') : 'unknown';
        const linenumber = match ? match[3] : 'unknown';
        return { filename, linenumber };
    }

    /**
     * Format a log message with timestamp, level tag, and location metadata.
     * @param {object} params - Formatting parameters.
     * @param {LogLevels} params.type - The log level.
     * @param {string} params.message - The log message.
     * @param {string} params.filename - The name of the file where the log originated.
     * @param {string} params.linenumber - The line number in the file where the log originated.
     * @returns {string} The formatted message.
     */
    private format({
        type,
        message,
        filename,
        linenumber,
    }: {
        type: LogLevels;
        message: string;
        filename: string;
        linenumber: string;
    }): string {
        const current_date = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const levels: Record<number, string | null> = {
            [LogLevels.debug]: '\x1b[35mDBG\x1b[0m',
            [LogLevels.error]: '\x1b[31mERR\x1b[0m',
            [LogLevels.info]: '\x1b[34mINF\x1b[0m',
            [LogLevels.log]: '\x1b[36mLOG\x1b[0m',
            [LogLevels.warn]: '\x1b[33mWRN\x1b[0m',
            [LogLevels.off]: null,
        };
        return `${levels[type]}[${current_date}][${filename}:${linenumber}] ${message}`;
    }

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
     * @param {string} key Localization key (e.g., 'events.index.loading').
     * @param {(string | number | unknown)[]} [replacements] Optional values to replace {0}, {1}, ... in the template.
     * @returns {string} Localized and formatted message.
     */
    public querySync(mode: keyof typeof LogLevels, key: string, replacements?: { [key: string]: unknown }): string {
        const file = jsonc.parse(
            fs.readFileSync(path.join(__dirname, `../localization/${Logger.current_language}.jsonc`), 'utf-8'),
        );
        let translation = file[mode][key] || '<missing translation> ' + key;
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
     * Placeholder hook to send logs to Discord for higher-severity levels.
     * Currently prints to console to indicate where an integration could be added.
     * @param {keyof typeof LogLevels} level Log severity of the message.
     * @param {string} formatted_message Already formatted message string.
     */
    private sendNotificationToDiscord(level: keyof typeof LogLevels, formatted_message: string): void {
        if (LogLevels[level] >= 4 && LogLevels[level] !== LogLevels.debug) {
            console.log(`[Discord Notification Placeholder][${level.toUpperCase()}] ${formatted_message}`);
        }
    }

    /**
     * Log a message at the provided level after localization and formatting.
     *
     * Behavior:
     * - If the level is filtered out by the current threshold, nothing is logged.
     * - For 'error' level, the process exits with code 1 after logging.
     *
     * @param {keyof typeof LogLevels} type One of 'debug' | 'error' | 'info' | 'log' | 'warn'.
     * @param {string} key Localization key for the message template.
     * @param {(string | number | unknown)[]} [replacements] Optional template replacement values.
     * @returns {void}
     */
    public send(type: keyof typeof LogLevels, key: string, replacements?: { [key: string]: unknown }): void {
        if (LogLevels[type] > Logger.selected_log_level) return;
        const msg = this.querySync(type, key, replacements);

        const { filename, linenumber } = this.getCallerInfo();
        const formatted_message = this.format({ type: LogLevels[type], message: msg, filename, linenumber });
        switch (type) {
            case 'error':
                console.log(formatted_message);
                this.sendNotificationToDiscord(type, formatted_message);
                process.exit(1);
                break;
            case 'warn':
                console.warn(formatted_message);
                this.sendNotificationToDiscord(type, formatted_message);
                break;
            default:
                console.log(formatted_message);
        }
    }

    /**
     * Update the current language for subsequent localization lookups.
     * @param {SupportedLanguages} lang New language to set.
     */
    public set setLanguage(lang: SupportedLanguages) {
        if (lang.toUpperCase() in SupportedLanguages) Logger.current_language = lang;
    }

    /**
     * Update the minimum log level threshold.
     * @param {LogLevels} level New log level to set as threshold.
     */
    public set setLogLevel(level: LogLevels) {
        if (level in LogLevels) Logger.selected_log_level = level;
    }

    /**
     * Obtain the Logger singleton instance.
     * @returns {Logger} Singleton instance.
     */
    public static getInstance(): Logger {
        if (!Logger.instance) Logger.instance = new Logger();
        return Logger.instance;
    }
}
