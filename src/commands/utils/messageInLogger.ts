import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DatabaseConnection } from "../../main";
import { MessageLogger } from "../../types/database/logger";
import { Messages } from "../../types/database/messages";
import { Command_t } from "../../types/interface/commands";

const exec = async (interaction: any) => {
    const logger = await DatabaseConnection.manager.findOne(MessageLogger, { where: { from_guild: { gid: interaction.guild.id } } });
    if (!logger.is_enabled) return interaction.reply({
        content: 'Logger is not enabled in this server',
        ephemeral: true,
    });

    const message_url = interaction.options.getString('message_id');
    const message_id = message_url.split('/').pop();
    if (!message_id) return interaction.reply({
        content: 'Invalid message URL',
        ephemeral: true,
    });
    
    const message_in_logger = (await DatabaseConnection.manager.findOne(Messages, { where: { message_id: message_id } }))?.logged_message_id;
    if (!message_in_logger) return interaction.reply({
        content: 'Message not found in logger',
        ephemeral: true,
    });
    return interaction.reply({
        content: `https://discord.com/channels/${logger.from_guild.gid}/${logger.channel_id}/${message_in_logger}`,
        ephemeral: true,
    });
}

const scb = async (): Promise<Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">> => {
    const data = new SlashCommandBuilder().setName('message_in_logger').setDescription('Get message URL from logger').setDefaultMemberPermissions(
        PermissionFlagsBits.ManageMessages,
    )
    data.addStringOption(option => option.setName('message_id').setDescription('Message ID or URL').setRequired(true))
    return data;
}

export default {
    enabled: true,
    name: 'message_in_logger',
    type: 'standard',
    description: 'Fetch message url from logger',

    category: 'utils',
    cooldown: 5,
    usage: '/messageInLogger <message_url>',

    data: scb,
    execute: exec,
} as Command_t;