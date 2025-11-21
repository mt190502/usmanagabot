import dayjs from 'dayjs';
import { Colors, EmbedBuilder } from 'discord.js';
import { BotClient } from './client';
import { Config } from './config';
import { SupportedLanguages, Translator } from './translator';

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
     * Translator instance for localization lookups.
     */
    private translator: Translator = Translator.getInstance();

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
     * Send logs to Discord for higher-severity levels.
     * Uses management config if enabled, otherwise falls back to LogNotifier database entries.
     * @param {string} type Log type: 'error' | 'warn'.
     * @param {string} message The log message.
     * @param {string} filename Source filename where the log originated.
     * @param {string} linenumber Source line number where the log originated.
     * @param {string} formatted_message Fully formatted log message.
     * @returns {Promise<void>} Resolves when the notification is sent or fails
     */
    private async sendNotificationToDiscord(
        type: string,
        message: string,
        filename: string,
        linenumber: string,
        formatted_message: string,
    ): Promise<void> {
        const management = Config.getInstance().current_botcfg.management;
        const client = BotClient.client;
        if (!client || !client.isReady()) return;

        const channel = await (await client.guilds.fetch(management.guild_id)).channels.fetch(management.channel_id);
        if (channel && channel.isTextBased()) {
            const post = new EmbedBuilder();
            let desc = '';
            if (type === 'error') {
                post.setTitle(':octagonal_sign: Error').setColor(Colors.Red);
                desc += `:octagonal_sign: **Message**: ${message}\n`;
            } else if (type === 'warn') {
                post.setTitle(':warning: Warning').setColor(Colors.Yellow);
                desc += `:warning: **Message**: ${message}\n`;
            }
            desc += `:page_facing_up: **File**: ${filename}\n`;
            desc += `:1234: **Line**: ${linenumber}\n\n`;
            post.setDescription(desc + `\`\`\`\n${formatted_message}\n\`\`\``);
            await channel.send({ embeds: [post] });
            return;
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
        const msg = this.translator.querySync(type, key, replacements);

        const { filename, linenumber } = this.getCallerInfo();
        const formatted_message = this.format({ type: LogLevels[type], message: msg, filename, linenumber });
        switch (type) {
            case 'error':
                console.log(formatted_message);
                this.sendNotificationToDiscord('error', key, filename, linenumber, formatted_message);
                process.exit(1);
                break;
            case 'warn':
                console.warn(formatted_message);
                this.sendNotificationToDiscord('warn', key, filename, linenumber, formatted_message);
                break;
            default:
                console.log(formatted_message);
        }
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
