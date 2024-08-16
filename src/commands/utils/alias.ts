import { Message, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Alias } from "../../types/database/alias";
import { Channels } from "../../types/database/channels";
import { Guilds } from "../../types/database/guilds";
import { Users } from "../../types/database/users";
import { Command_t } from "../../types/interface/commands";

const exec = async (interaction: any) => {
    const subcommand = interaction.options.getSubcommand();
    const alias_content = interaction.options.getString('alias_content');
    const alias_name = interaction.options.getString('alias_name');
    const existing_alias = await DatabaseConnection.manager.findOne(Alias, { where: { name: alias_name, from_guild: { gid: interaction.guild.id } } });

    switch (subcommand) {
        case 'add':
            if (existing_alias) {
                await interaction.reply(`Alias **${alias_name}** already exists`);
                break;
            }
            if (alias_name.includes(' ')) {
                await interaction.reply('Alias name cannot contain spaces');
                break;
            }
            const new_alias = new Alias()
            new_alias.name = alias_name;
            new_alias.content = alias_content;
            new_alias.from_guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });
            new_alias.from_channel = await DatabaseConnection.manager.findOne(Channels, { where: { cid: interaction.channel.id } });
            new_alias.from_user = await DatabaseConnection.manager.findOne(Users, { where: { uid: BigInt(interaction.user.id) } });
            await DatabaseConnection.manager.save(new_alias).then(() => {
                interaction.reply(`Added alias **${alias_name}** for keyword **${alias_content}**`);
            }).catch((err) => {
                interaction.reply(`Failed to add alias **${alias_name}** for keyword **${alias_content}**`);
            });
            break;
        case 'remove':
            if (!existing_alias) {
                await interaction.reply(`Alias **${alias_name}** does not exist`);
                break;
            }
            await DatabaseConnection.manager.remove(existing_alias).then(() => {
                interaction.reply(`Removed alias **${alias_name}**`);
            }).catch((err) => {
                interaction.reply(`Failed to remove alias **${alias_name}** for keyword **${alias_content}**`);
            });
            break;
        case 'list':
            const aliases = await DatabaseConnection.manager.find(Alias, { where: { from_guild: { gid: interaction.guild.id } } });
            if (!aliases) {
                await interaction.reply('No aliases found');
                break;
            }
            let alias_list = '';
            aliases.forEach((alias) => {
                alias_list += `**${alias.name}**\n`;
            });
            await interaction.reply(`Aliases for this server:\n${alias_list}`);
            break;
        case 'modify':
            if (!existing_alias) {
                await interaction.reply(`Alias **${alias_name}** does not exist`);
                break;
            }
            existing_alias.content = alias_content;
            await DatabaseConnection.manager.save(existing_alias).then(() => {
                interaction.reply(`Modified alias **${alias_name}** for keyword **${alias_content}**`);
            }).catch((err) => {
                interaction.reply(`Failed to modify alias **${alias_name}** for keyword **${alias_content}**\n${err}`);
            });
            break;
        default:
            await interaction.reply('Invalid action');
            break;
    }
}

const scb = async (): Promise<Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">> => {
    const data = new SlashCommandBuilder().setName('alias').setDescription('Create an alias for keyword').setDefaultMemberPermissions(
        PermissionFlagsBits.ManageMessages,
    );
    data.addSubcommand(subcommand => subcommand.setName('add').setDescription('Add an alias').addStringOption(
        option => option.setName('alias_name').setDescription('Name').setRequired(true)
    ).addStringOption(
        option => option.setName('alias_content').setDescription('Content (Variables: {{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})').setRequired(true)
    ));
    data.addSubcommand(subcommand => subcommand.setName('remove').setDescription('Remove an alias').addStringOption(
        option => option.setName('alias_name').setDescription('Name').setRequired(true)
    ));
    data.addSubcommand(subcommand => subcommand.setName('modify').setDescription('Modify an alias').addStringOption(
        option => option.setName('alias_name').setDescription('Name').setRequired(true)
    ).addStringOption(
        option => option.setName('alias_content').setDescription('Content (Variables: {{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})').setRequired(true)
    ));
    data.addSubcommand(subcommand => subcommand.setName('list').setDescription('List all aliases'));
    return data;
}

const exec_when_event = async (event_name: string, message: Message) => {
    const replace_table = [
        { key: '{{user}}', value: `<@${message.author.id}>` },
        { key: '{{user_id}}', value: message.author.id },
        { key: '{{channel}}', value: `<#${message.channel.id}>` },
        { key: '{{channel_id}}', value: message.channel.id },
        { key: '{{guild}}', value: message.guild.name },
        { key: '{{mentioned_users}}', value: '' }
    ]
    switch (event_name) {
        case 'messageCreate':;
            const alias_name = message.content.split(' ')[0];
            const alias = await DatabaseConnection.manager.findOne(Alias, { where: { name: alias_name, from_guild: { gid: message.guild.id } } });
            if (!alias) return;
            message.mentions.users.forEach((user) => {
                replace_table.find((replace) => replace.key === '{{mentioned_users}}').value += `<@${user.id}>, `;
            });
            replace_table.forEach((replace) => {
                alias.content = alias.content.replaceAll(replace.key, replace.value);
            });
            message.channel.send(alias.content);
            
            break;
        default:
            break;
    }
}
export default {
    enabled: true,
    name: 'alias',
    type: 'customizable',
    description: 'Manage aliases',

    category: 'utils',
    cooldown: 5,
    usage: '/alias <add|remove|list> <keyword> <alias>',
    usewithevent: ['messageCreate'],

    data: scb,
    execute: exec,
    execute_when_event: exec_when_event,
} as Command_t;