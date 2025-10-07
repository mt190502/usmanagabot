import dayjs from 'dayjs';
import fs from 'fs';
import jsonc from 'jsonc-parser';
import path from 'path';

/**
 * Enumeration for log levels.
 * This enum defines the various log levels used in the Logger class.
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
 * Enumeration for supported languages.
 * This enum defines the supported languages for localization.
 */
export enum SupportedLanguages {
    EN = 'en',
    TR = 'tr',
}

/**
 * Logger class for managing logging functionality.
 * This class provides methods to log messages at different levels
 * and format them for console output.
 */
export class Logger {
    private static instance: Logger | null = null;
    private static current_language: SupportedLanguages = SupportedLanguages.EN;
    private static selected_log_level: LogLevels =
        process.env.NODE_ENV === 'production' ? LogLevels.error : LogLevels.debug;

    /**
     * Gets the current caller information (filename and line number).
     * This method retrieves the caller's filename and line number from the stack trace.
     * @return {Object} object: An object containing the filename and line number of the caller.
     * @return {string} object.filename - The filename of the caller.
     * @return {string} object.linenumber - The line number of the caller.
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
        const filename = match ? ((match[1] || match[2]).split(/[\\/]/).pop() ?? 'unknown') : 'unknown';
        const linenumber = match ? match[3] : 'unknown';
        return { filename, linenumber };
    }

    /**
     * Formats the log message with the current date, type, filename, and line number.
     * This method formats the log message for console output.
     * @param {Object} params - The parameters for formatting the log message.
     * @param {LogLevels} params.type - The type of log message (debug, error, info, log, warn).
     * @param {string} params.message - The log message to format.
     * @param {string} params.filename - The filename of the caller.
     * @param {string} params.linenumber - The line number of the caller.
     * @return The formatted log message as a string.
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
        const levels: Record<string, string> = {
            [LogLevels.debug]: '\x1b[35mDBG\x1b[0m',
            [LogLevels.error]: '\x1b[31mERR\x1b[0m',
            [LogLevels.info]: '\x1b[34mINF\x1b[0m',
            [LogLevels.log]: '\x1b[36mLOG\x1b[0m',
            [LogLevels.warn]: '\x1b[33mWRN\x1b[0m',
        };
        return `${levels[type]}[${current_date}][${filename}:${linenumber}] ${message}`;
    }

    /**
     * Translates a given key into the current language, optionally formatting it with provided arguments (synchronous version).
     * @param key The key to translate.
     * @param args Optional arguments to format the translated string.
     * @returns The translated and formatted string.
     */
    public querySync(key: string, replacements?: (string | number | unknown)[]): string {
        const file = jsonc.parse(
            fs.readFileSync(path.join(__dirname, `../localization/${Logger.current_language}.jsonc`), 'utf-8')
        );
        let translation = file[key] || key;
        if (replacements && replacements.length > 0) {
            for (const [index, value] of replacements.entries()) {
                translation = translation.replace(`{${index}}`, String(value));
            }
        }
        return translation;
    }

    /**
     * Sends a notification to Discord
     * @param {keyof typeof LogLevels} level - The log level of the message.
     * @param {string} formatted_message - The formatted log message.
     */
    private sendNotificationToDiscord(level: keyof typeof LogLevels, formatted_message: string): void {
        if (LogLevels[level] >= 4) {
            console.log(`[Discord Notification Placeholder][${level.toUpperCase()}] ${formatted_message}`);
        }
    }

    /**
     * Sends a log message to the console based on the specified log level.
     * This method checks the current log level and formats the message accordingly.
     * @param {keyof typeof LogLevels} type - The type of log message (debug, error, info, log, warn).
     * @param {string} key - The translation key for the log message.
     * @param {(string | number | unknown)[]} [replacements] - Optional replacements for the translation key.
     */
    public send(type: keyof typeof LogLevels, key: string, replacements?: (string | number | unknown)[]): void {
        if (LogLevels[type] > Logger.selected_log_level) return;
        const msg = this.querySync(key, replacements);

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
     * Updates the current language for localization.
     * This method allows dynamic updating of the language used for translations.
     * @param {SupportedLanguages} lang - The new language to set.
     */
    public set setLanguage(lang: SupportedLanguages) {
        if (lang.toUpperCase() in SupportedLanguages) Logger.current_language = lang;
    }

    /**
     * Updates the log level settings based on the provided configuration.
     * This method allows dynamic updating of the log level.
     * @param {BotConfig_t['log_level']} cfg - The new log level to set.
     */
    public set setLogLevel(level: LogLevels) {
        if (level in LogLevels) Logger.selected_log_level = level;
    }

    /**
     * Gets the singleton instance of the Logger class.
     * This method ensures that only one instance of Logger is created.
     * @return The singleton instance of Logger.
     */
    public static getInstance(): Logger {
        if (!Logger.instance) Logger.instance = new Logger();
        return Logger.instance;
    }
}
