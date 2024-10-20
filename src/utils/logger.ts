import dayjs from 'dayjs';
import { EmbedBuilder } from 'discord.js';
import { DatabaseConnection } from '../main';
import { LogNotifier } from '../types/database/lognotifier';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Logger = async (type: 'debug' | 'error' | 'info' | 'log' | 'warn', msg: string, interaction?: any) => {
    const line = new Error().stack.split('\n')[2].split('/').at(-1);
    const [filename, lineNumber] = line.split(':');
    const currdate = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const logColors = {
        debug: '\x1b[35mDEBU\x1b[0m',
        error: '\x1b[31mERRO\x1b[0m',
        info: '\x1b[34mINFO\x1b[0m',
        log: '\x1b[36mLOG \x1b[0m',
        warn: '\x1b[33mWARN\x1b[0m',
    };

    const logMessage = `[${currdate}][${filename}:${lineNumber}] ${msg}`;
    console[type](`${logColors[type]}${logMessage}`);

    if (interaction && ['error', 'info', 'warn'].includes(type)) {
        const notify = new EmbedBuilder()
            .setTitle(
                `${type === 'warn' ? ':warning: Warning' : type === 'error' ? ':octagonal_sign: Error' : ':information_source: Information'} Notification`
            )
            .setColor(type === 'error' ? 'Red' : type === 'warn' ? 'Yellow' : 'Blue')
            .setDescription(
                `${type === 'warn' ? ':warning:' : type === 'error' ? ':octagonal_sign:' : ':information_source:'} **${type.charAt(0).toUpperCase() + type.slice(1)}**: ${msg}\n:page_facing_up: **File**: ${filename}\n:1234: **Line**: ${lineNumber}`
            );

        const log_notifier = await DatabaseConnection.manager.findOne(LogNotifier, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        });

        if (log_notifier) {
            if (log_notifier.is_enabled) {
                await interaction.guild.channels.cache.get(log_notifier.channel_id).send({ embeds: [notify] });
            }
        }
    }
};
