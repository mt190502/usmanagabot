import {
    ApplicationCommandType,
    ChatInputCommandInteraction,
    ContextMenuCommandBuilder,
    MessageContextMenuCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { MessageLogger } from '../../types/database/message_logger';
import { Messages } from '../../types/database/messages';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const exec = async (interaction: MessageContextMenuCommandInteraction | ChatInputCommandInteraction): Promise<void> => {
    const logger = await DatabaseConnection.manager
        .findOne(MessageLogger, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    if (!logger || !logger.is_enabled) {
        await interaction.reply({
            content: 'Logger is not enabled in this server',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    let message_id: string;
    if (interaction.isMessageContextMenuCommand()) {
        message_id = interaction.targetId;
    } else if (interaction.isChatInputCommand()) {
        message_id = BigInt(interaction.options.getString('message_id').split('/').pop()).toString();
    }

    const message_in_logger = (
        await DatabaseConnection.manager
            .findOne(Messages, { where: { message_id: BigInt(message_id) } })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            })
    )?.logged_message_id;

    if (!message_in_logger) {
        await interaction.reply({
            content: 'Message not found in logger',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        content: `https://discord.com/channels/${logger.from_guild.gid}/${logger.channel_id}/${message_in_logger}`,
        flags: MessageFlags.Ephemeral,
    });
};

const cmcb = async (): Promise<ContextMenuCommandBuilder> => {
    return new ContextMenuCommandBuilder()
        .setName('Find Message in Logger')
        .setType(ApplicationCommandType.User | ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
};

const scb = async (): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const data = new SlashCommandBuilder()
        .setName('find_message_in_logger')
        .setDescription('Get message URL from logger')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
    data.addStringOption((option) =>
        option.setName('message_id').setDescription('Message ID or URL').setRequired(true)
    );
    return data;
};

export default {
    enabled: true,
    name: 'find_message_in_logger',
    pretty_name: 'Find Message in Logger',
    type: 'standard',
    description: 'Fetch message URL from logger',

    category: 'admin',
    cooldown: 5,
    parameters: '<message_url>',

    data: [cmcb, scb],
    execute: exec,
} as Command_t;
