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
 * A static class for localized, leveled logging with formatted output.
 *
 * Features:
 * - **Leveled Logging**: Filters messages by severity (debug, log, info, warn, error).
 * - **Localization**: Fetches log messages from translation files via the `Translator` service.
 * - **Rich Formatting**: Adds timestamp, color-coded level, and caller file/line info to messages.
 * - **Discord Notifications**: Sends high-severity logs (error, warn) to a configured Discord channel.
 *
 * All methods are static. `Logger.init()` should be called at startup to apply the configured log level.
 */
export class Logger {
    /**
     * The `Translator` class, used for localizing log messages.
     * @private
     */
    private static translator: typeof Translator = Translator;

    /**
     * The language used for localizing log messages.
     * @private
     */
    private static current_language: SupportedLanguages = SupportedLanguages.EN_US;

    /**
     * The minimum log level to be processed. Messages with a lower severity will be ignored.
     * @private
     */
    private static selected_log_level: LogLevels =
        process.env.NODE_ENV === 'production' ? LogLevels.error : LogLevels.debug;

    /**
     * Determine caller filename and line from a stack trace.
     * @returns {{filename: string, linenumber: string}} The caller's source filename and line number.
     */
    private static getCallerInfo(): { filename: string; linenumber: string } {
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
    private static format({
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
     * Uses the management channel configuration from `Config`.
     * @private
     * @param {string} type The log level type ('error' or 'warn').
     * @param {string} message The log message.
     * @param {string} filename Source filename where the log originated.
     * @param {string} linenumber Source line number where the log originated.
     * @param {string} formatted_message Fully formatted log message.
     * @returns {Promise<void>} Resolves when the notification is sent or fails
     */
    private static async sendNotificationToDiscord(
        type: string,
        message: string,
        filename: string,
        linenumber: string,
        formatted_message: string,
    ): Promise<void> {
        const management = Config.current_botcfg.management;
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
     * - If the message's log level is below the configured `selected_log_level`, it is ignored.
     * - `error` and `warn` messages are also sent as notifications to a configured Discord channel.
     *
     * @public
     * @static
     * @param {'commands' | 'events' | 'services' | 'system'} namespace The translation namespace.
     * @param {string} caller The caller identifier for translation context.
     * @param {keyof typeof LogLevels} type The log level type.
     * @param {string} key The translation key for the log message.
     * @param {{ [key: string]: unknown }} [replacements] Optional replacements for the translation.
     * @returns {void}
     */
    public static send(
        namespace: 'commands' | 'events' | 'services' | 'system',
        caller: string,
        type: keyof typeof LogLevels,
        key: string,
        replacements?: { [key: string]: unknown },
    ): void {
        if (LogLevels[type] > Logger.selected_log_level) return;
        const cmd = Translator.generateQueryFunc({ caller, lang: Logger.current_language });
        let msg;
        if (namespace === 'commands') {
            msg = cmd.commands({ key: `logging.${type}.${key}`, replacements });
            msg = msg.startsWith('logging.') ? '<missing translation> ' + msg : msg;
        } else {
            msg = cmd[namespace as keyof typeof cmd]({ key: `${type}.${key}`, replacements });
        }

        const { filename, linenumber } = Logger.getCallerInfo();
        const formatted_message = Logger.format({ type: LogLevels[type], message: msg, filename, linenumber });
        switch (type) {
            case 'error':
                console.log(formatted_message);
                Logger.sendNotificationToDiscord('error', key, filename, linenumber, formatted_message);
                break;
            case 'warn':
                console.warn(formatted_message);
                Logger.sendNotificationToDiscord('warn', key, filename, linenumber, formatted_message);
                break;
            default:
                console.log(formatted_message);
        }
    }

    /**
     * Sets the minimum log level threshold.
     * @public
     * @static
     * @param {LogLevels} level The new minimum log level.
     */
    public static set setLogLevel(level: LogLevels) {
        if (level in LogLevels) Logger.selected_log_level = level;
    }
}
