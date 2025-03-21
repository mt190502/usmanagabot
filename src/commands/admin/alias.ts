import {
    ChatInputCommandInteraction,
    Message,
    PartialDMChannel,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { DatabaseConnection } from '../../main';
import { Alias } from '../../types/database/alias';
import { Channels } from '../../types/database/channels';
import { Guilds } from '../../types/database/guilds';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';
import { RESTCommandLoader } from '../loader';

const exec = async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const alias_content = interaction.options.getString('alias_content');
    const alias_name = interaction.options.getString('alias_name');
    const existing_alias = await DatabaseConnection.manager
        .findOne(Alias, {
            where: { name: alias_name, from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    switch (subcommand) {
        case 'add': {
            if (existing_alias) {
                await interaction.reply(`Alias **${alias_name}** already exists`);
                break;
            }
            if (alias_name.includes(' ')) {
                await interaction.reply('Alias name cannot contain spaces');
                break;
            }
            const new_alias = new Alias();
            new_alias.name = alias_name;
            new_alias.content = alias_content;
            new_alias.from_guild = await DatabaseConnection.manager
                .findOne(Guilds, {
                    where: { gid: BigInt(interaction.guild.id) },
                })
                .catch((err) => {
                    Logger('error', err, interaction);
                    throw err;
                });
            new_alias.from_channel = await DatabaseConnection.manager
                .findOne(Channels, {
                    where: { cid: BigInt(interaction.channel.id) },
                })
                .catch((err) => {
                    Logger('error', err, interaction);
                    throw err;
                });
            new_alias.from_user = await DatabaseConnection.manager
                .findOne(Users, {
                    where: { uid: BigInt(interaction.user.id) },
                })
                .catch((err) => {
                    Logger('error', err, interaction);
                    throw err;
                });
            await DatabaseConnection.manager.save(new_alias).catch((err) => {
                Logger('error', err, interaction);
            });
            await RESTCommandLoader(BigInt(interaction.guild.id), __filename).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.reply(`Added alias **${alias_name}** for keyword **${alias_content}**`);
            break;
        }
        case 'remove': {
            if (!existing_alias) {
                await interaction.reply(`Alias **${alias_name}** does not exist`);
                break;
            }
            await DatabaseConnection.manager.remove(existing_alias).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.reply(`Removed alias **${alias_name}**`);
            break;
        }
        case 'list': {
            const aliases = await DatabaseConnection.manager
                .find(Alias, {
                    where: { from_guild: { gid: BigInt(interaction.guild.id) } },
                })
                .catch((err) => {
                    Logger('error', err, interaction);
                    throw err;
                });
            if (!aliases.length) {
                await interaction.reply('No aliases found');
                break;
            }
            const alias_list = aliases.map((alias) => `**${alias.name}**`).join('\n');
            await interaction.reply(`Aliases for this server:\n${alias_list}`);
            break;
        }
        case 'modify': {
            if (!existing_alias) {
                await interaction.reply(`Alias **${alias_name}** does not exist`);
                break;
            }
            existing_alias.content = alias_content;
            await DatabaseConnection.manager.save(existing_alias).catch((err) => {
                Logger('error', err, interaction);
            });
            await interaction.reply(`Modified alias **${alias_name}** for keyword **${alias_content}**`);
            break;
        }
        default:
            await interaction.reply('Invalid action');
            break;
    }
};

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const data = new SlashCommandBuilder()
        .setName('alias')
        .setDescription('Create an alias for keyword')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

    const db = await DatabaseConnection.manager.find(Alias, {
        where: { from_guild: { gid: guild.gid } },
    });

    const choices: { name: string; value: string }[] = [];
    for (const alias of db) {
        choices.push({ name: alias.name, value: alias.name });
    }

    data.addSubcommand((subcommand) =>
        subcommand
            .setName('add')
            .setDescription('Add an alias')
            .addStringOption((option) => option.setName('alias_name').setDescription('Name').setRequired(true))
            .addStringOption((option) =>
                option
                    .setName('alias_content')
                    .setDescription(
                        'Content (Variables: {{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})'
                    )
                    .setRequired(true)
            )
    );
    data.addSubcommand((subcommand) =>
        subcommand
            .setName('remove')
            .setDescription('Remove an alias')
            .addStringOption((option) =>
                option.setName('alias_name').setDescription('Name').setRequired(true).setChoices(choices)
            )
    );

    data.addSubcommand((subcommand) =>
        subcommand
            .setName('modify')
            .setDescription('Modify an alias')
            .addStringOption((option) =>
                option.setName('alias_name').setDescription('Name').setRequired(true).setChoices(choices)
            )
            .addStringOption((option) =>
                option
                    .setName('alias_content')
                    .setDescription(
                        'Content (Variables: {{user}},{{user_id}},{{channel}},{{channel_id}},{{guild}},{{mentioned_users}})'
                    )
                    .setRequired(true)
            )
    );

    data.addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all aliases'));
    return data;
};

const execWhenEvent = async (event_name: string, message: Message) => {
    const replace_table = [
        { key: '{{user}}', value: `<@${message.author.id}>` },
        { key: '{{user_id}}', value: message.author.id },
        { key: '{{channel}}', value: `<#${message.channel.id}>` },
        { key: '{{channel_id}}', value: message.channel.id },
        { key: '{{guild}}', value: message.guild.name },
        { key: '{{mentioned_users}}', value: '' },
    ];
    switch (event_name) {
        case 'messageCreate': {
            const alias_name = message.content.split(' ')[0];
            const alias = await DatabaseConnection.manager
                .findOne(Alias, {
                    where: { name: alias_name, from_guild: { gid: BigInt(message.guild.id) } },
                })
                .catch((err) => {
                    Logger('error', err, message);
                });
            if (!alias) return;

            for (const user of message.mentions.users.values()) {
                replace_table.find((replace) => replace.key === '{{mentioned_users}}').value += `<@${user.id}>, `;
            }
            for (const replace of replace_table) {
                alias.content = alias.content.replaceAll(replace.key, replace.value);
            }
            (message.channel as PartialDMChannel).send(alias.content);
            break;
        }
    }
};

export default {
    enabled: true,
    name: 'alias',
    type: 'customizable',
    pretty_name: 'Alias',
    description: 'Manage aliases',

    category: 'admin',
    cooldown: 5,
    parameters: '<add|remove|list> <keyword> <alias>',
    usewithevent: ['messageCreate'],

    data: [scb],
    execute: exec,
    execute_when_event: execWhenEvent,
} as Command_t;
