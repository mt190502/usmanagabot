import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChannelSelectMenuBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    ColorResolvable,
    Colors,
    EmbedBuilder,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import yaml from 'yaml';
import { DatabaseConnection } from '../../main';
import { Guilds } from '../../types/database/guilds';
import { Introduction } from '../../types/database/introduction';
import { IntroductionSubmit } from '../../types/database/introduction_submit';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';
import { RESTCommandLoader } from '../loader';

interface IntroductionColumn {
    name: string;
    value: string;
}

const settings = async (
    interaction: StringSelectMenuInteraction | ModalSubmitInteraction | ChannelSelectMenuInteraction
) => {
    const introduction = await DatabaseConnection.manager
        .findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    if (!introduction) {
        const new_introduction = new Introduction();
        new_introduction.cmd_name = 'introduction';
        new_introduction.cmd_desc = 'User introduction database';
        new_introduction.from_guild = await DatabaseConnection.manager
            .findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        new_introduction.from_user = await DatabaseConnection.manager
            .findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        await DatabaseConnection.manager.save(new_introduction).catch((err) => {
            Logger('error', err, interaction);
        });
        return settings(interaction);
    }

    const cmd_name = new TextInputBuilder()
        .setCustomId('cmd_name')
        .setLabel('Command Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(introduction.cmd_name)
        .setRequired(false);
    const cmd_desc = new TextInputBuilder()
        .setCustomId('cmd_desc')
        .setLabel('Command Description')
        .setPlaceholder(introduction.cmd_desc)
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
    const column_names = new TextInputBuilder()
        .setCustomId('column_names')
        .setLabel('Column Names')
        .setPlaceholder('- name: key\n  value: value\n(max 8 columns)')
        .setValue(introduction.yaml_data || '- name: key1\n  value: value1\n- name: key2\n  value: value2')
        .setStyle(TextInputStyle.Paragraph);
    const channel_select_menu = new ChannelSelectMenuBuilder()
        .setCustomId('settings:introduction:41')
        .setPlaceholder('Select a channel')
        .setChannelTypes(ChannelType.GuildText);

    let introduction_status = introduction.is_enabled ? 'Disable' : 'Enable';

    const genPostEmbed = (warn?: string): EmbedBuilder => {
        const post = new EmbedBuilder().setTitle(':gear: Introduction Settings');
        const fields: { name: string; value: string }[] = [];
        if (warn) {
            post.setColor(Colors.Yellow);
            fields.push({ name: ':warning: Warning', value: warn });
        } else {
            post.setColor(Colors.Blurple);
        }
        fields.push(
            {
                name: 'Enabled',
                value: introduction.is_enabled ? ':green_circle: True' : ':red_circle: False',
            },
            { name: 'Introduction Channel', value: `<#${introduction.channel_id}>` },
            { name: 'Command Name', value: introduction.cmd_name || 'not defined' },
            { name: 'Command Description', value: introduction.cmd_desc || 'not defined' }
        );
        post.addFields(fields);
        return post;
    };

    const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
        const menu = new StringSelectMenuBuilder().setCustomId('settings:introduction:0').addOptions([
            {
                label: `${introduction_status} Introduction System`,
                description: `${introduction_status} the introduction system`,
                value: 'settings:introduction:1',
            },
            {
                label: 'Change Command Settings',
                description: 'Change the command name and description',
                value: 'settings:introduction:2',
            },
            {
                label: 'Change Column Names',
                description: 'Change the column names',
                value: 'settings:introduction:3',
            },
            {
                label: 'Change Introduction Channel',
                description: 'Change the channel where introductions are sent',
                value: 'settings:introduction:4',
            },
            { label: 'Back', description: 'Go back to the main menu', value: 'settings' },
        ]);
        return new ActionRowBuilder()
            .addComponents(menu)
            .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>;
    };

    let menu_path;
    if (interaction.isStringSelectMenu()) {
        menu_path = (interaction as StringSelectMenuInteraction).values[0].split(':').at(-1).split('/');
    } else if (interaction.isModalSubmit() || interaction.isChannelSelectMenu()) {
        menu_path = (interaction as ModalSubmitInteraction).customId.split(':').at(-1).split('/');
    }

    switch (menu_path[0]) {
        case '1':
            introduction.is_enabled = !introduction.is_enabled;
            introduction_status = introduction.is_enabled ? 'Disable' : 'Enable';
            await DatabaseConnection.manager.save(introduction).catch((err) => {
                Logger('error', err, interaction);
            });
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            await RESTCommandLoader(introduction.from_guild.gid, __filename).catch((err) => {
                Logger('error', err, interaction);
            });
            break;
        case '2':
            await (interaction as StringSelectMenuInteraction).showModal(
                new ModalBuilder()
                    .setCustomId('settings:introduction:21')
                    .setTitle('Change Command Settings')
                    .addComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(cmd_name),
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(cmd_desc)
                    )
            );
            break;
        case '3':
            await (interaction as StringSelectMenuInteraction).showModal(
                new ModalBuilder()
                    .setCustomId('settings:introduction:31')
                    .setTitle('Change Column Names')
                    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(column_names))
            );
            break;
        case '4':
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [
                    new ActionRowBuilder()
                        .addComponents(channel_select_menu)
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '21': {
            const requested_cmd_name = (interaction as ModalSubmitInteraction).fields
                .getTextInputValue('cmd_name')
                .replaceAll(/\s/g, '_')
                .replaceAll(/\W/g, '')
                .toLowerCase();
            const requested_cmd_desc = (interaction as ModalSubmitInteraction).fields
                .getTextInputValue('cmd_desc')
                .replaceAll(/\W/g, ' ');

            if (requested_cmd_name.length === 0 || requested_cmd_desc.length === 0) {
                await (interaction as ModalSubmitInteraction).reply({
                    embeds: [genPostEmbed('Command name and description cannot be empty')],
                    components: [genMenuOptions()],
                    ephemeral: true,
                });
                return;
            }

            introduction.cmd_name = requested_cmd_name;
            introduction.cmd_desc = requested_cmd_desc;

            await DatabaseConnection.manager.save(introduction).catch((err) => {
                Logger('error', err, interaction);
            });
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            await RESTCommandLoader(introduction.from_guild.gid, __filename).catch((err) => {
                Logger('error', err, interaction);
            });
            break;
        }
        case '31': {
            const columns = (interaction as ModalSubmitInteraction).fields.getTextInputValue('column_names');
            let parsed = yaml.parse(columns) as IntroductionColumn[];
            if (parsed.length > 8) {
                parsed = parsed.slice(0, 8);
            }

            const namesSet = new Set<string>();
            for (const column of parsed) {
                if (namesSet.has(column.name)) {
                    await (interaction as ModalSubmitInteraction).reply({
                        embeds: [genPostEmbed(`Column name \`${column.name}\` is duplicated`)],
                        ephemeral: true,
                    });
                    return;
                }
                namesSet.add(column.name);
            }

            for (let i = 0; i < 8; i++) {
                if (!parsed[i]) parsed[i] = { name: null, value: null };
                (introduction[`col${i + 1}` as keyof Introduction] as string[]) = [parsed[i].name, parsed[i].value];
            }

            introduction.yaml_data = columns;
            await DatabaseConnection.manager.save(introduction).catch((err) => {
                Logger('error', err, interaction);
            });
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            await RESTCommandLoader(introduction.from_guild.gid, __filename).catch((err) => {
                Logger('error', err, interaction);
            });
            break;
        }
        case '41':
            introduction.channel_id = (interaction as StringSelectMenuInteraction).values[0];
            await DatabaseConnection.manager.save(introduction).catch((err) => {
                Logger('error', err, interaction);
            });
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        default:
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
    }
};

const exec = async (interaction: ChatInputCommandInteraction) => {
    const introduction = await DatabaseConnection.manager
        .findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });
    const last_introduction_submit =
        (await DatabaseConnection.manager
            .findOne(IntroductionSubmit, {
                where: {
                    from_guild: { gid: BigInt(interaction.guild.id) },
                    from_user: { uid: BigInt(interaction.user.id) },
                },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            })) || new IntroductionSubmit();

    const post = new EmbedBuilder();

    const now_timestamp = new Date().getTime();
    const last_submit_timestamp = last_introduction_submit.timestamp ? last_introduction_submit.timestamp.getTime() : 0;
    const diff_timestamp = now_timestamp - last_submit_timestamp;
    const end_timestamp = (now_timestamp + 86400000 - diff_timestamp) / 1000;

    if (diff_timestamp < 86400000 && diff_timestamp >= 3600 && last_introduction_submit.hourly_submit_count === 3) {
        const msg = `You have reached the maximum number of submissions for today.\nPlease try again on date: <t:${Math.floor(end_timestamp)}:F>`;
        post.setTitle(':warning: Warning').setDescription(msg).setColor(Colors.Red);
        await interaction.reply({
            embeds: [post],
            ephemeral: true,
        });
        return;
    }

    last_introduction_submit.hourly_submit_count =
        now_timestamp - last_submit_timestamp > 86400000 ? 1 : last_introduction_submit.hourly_submit_count + 1;

    if (!introduction.is_enabled || !introduction.channel_id) {
        post.setTitle(':warning: Warning')
            .setDescription('Introduction system is not set up properly.\nPlease contact the server administrator.')
            .setColor(Colors.Red);
        await interaction.reply({
            embeds: [post],
            ephemeral: true,
        });
        return;
    }

    const user_roles = interaction.guild.members.cache
        .get(interaction.user.id)
        .roles.cache.sort((a, b) => b.position - a.position);
    const data: string[] = [`**__About ${interaction.user.username}__**\n`];

    let values = 0;
    for (let i = 1; i <= 8; i++) {
        const key = introduction[`col${i}` as keyof Introduction];
        if (Array.isArray(key)) {
            const value =
                interaction.options.getString(key[0]) ||
                (last_introduction_submit[`col${i}` as keyof IntroductionSubmit] as string) ||
                null;
            if (value && value.length > 0 && key[1]) {
                data.push(`**${key[1]}**: ${value}\n`);
                (last_introduction_submit[`col${i}` as keyof IntroductionSubmit] as string) = value;
                values++;
            }
        }
    }

    if (values === 0) {
        post.setTitle(':warning: Warning').setDescription('Please provide at least one value').setColor(Colors.Red);
        await interaction.reply({ embeds: [post], ephemeral: true });
        return;
    }

    data.push(
        '\n**__Account Information__**\n',
        `**Username**: ${interaction.user.username}\n`,
        `**Nickname**: <@!${interaction.user.id}>\n`,
        `**ID**: ${interaction.user.id}\n`,
        `**Created At**: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>\n`,
        `**Joined At**: <t:${Math.floor(interaction.guild.members.cache.get(interaction.user.id)?.joinedTimestamp / 1000)}:R>\n`,
        `**Roles**: ${
            user_roles
                .filter((r) => r.name !== '@everyone')
                .map((r) => `<@&${r.id}>`)
                .join(', ') || 'None'
        }\n`
    );

    const color = user_roles.map((r) => r.hexColor).find((c) => c !== '#000000') as ColorResolvable;
    const embed = new EmbedBuilder()
        .setDescription(data.join(''))
        .setColor(color || 'Random')
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();
    if (last_submit_timestamp) embed.setFooter({ text: 'Introduction Updated' });

    const target_channel = interaction.guild.channels.cache.get(introduction.channel_id) as TextChannel;
    const publish = await target_channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });

    if (last_introduction_submit.last_submit_id) {
        const old_message = await target_channel.messages.fetch(last_introduction_submit.last_submit_id.toString());
        if (old_message) await old_message.delete();
    }

    last_introduction_submit.last_submit_id = BigInt(publish.id);
    last_introduction_submit.timestamp = new Date();
    last_introduction_submit.from_user = await DatabaseConnection.manager
        .findOne(Users, {
            where: { uid: BigInt(interaction.user.id) },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });
    last_introduction_submit.from_guild = await DatabaseConnection.manager
        .findOne(Guilds, {
            where: { gid: BigInt(interaction.guild.id) },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });
    await DatabaseConnection.manager.save(last_introduction_submit).catch((err) => {
        Logger('error', err, interaction);
    });

    post.setTitle(':white_check_mark: Success')
        .setColor(Colors.Green)
        .setDescription(
            `Introduction submitted successfully.\nYou have **${3 - last_introduction_submit.hourly_submit_count}** submissions left for today.\nIntroduction URL: ${publish.url}`
        );
    await interaction.reply({
        embeds: [post],
        ephemeral: true,
    });
};

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    const introduction = await DatabaseConnection.manager
        .findOne(Introduction, {
            where: { from_guild: { gid: BigInt(guild.gid) } },
        })
        .catch((err) => {
            Logger('error', err);
            throw err;
        });

    if (!introduction) {
        return new SlashCommandBuilder().setName('introduction').setDescription('User introduction database');
    }
    const data = new SlashCommandBuilder()
        .setName('introduction')
        .setDescription(introduction.cmd_desc)
        .setNameLocalization(guild.country, introduction.cmd_name);
    for (let i = 1; i <= 8; i++) {
        const colName = `col${i}` as keyof Introduction;
        if ((introduction[colName] as string[])[0] === null && (introduction[colName] as string[])[1] === null) {
            continue;
        }
        data.addStringOption((option) =>
            option
                .setName((introduction[colName] as string[])[0])
                .setDescription((introduction[colName] as string[])[1])
        );
    }
    return data;
};

export default {
    enabled: true,
    name: 'introduction',
    type: 'customizable',

    description: 'User introduction database',
    category: 'misc',
    cooldown: 5,
    usage: '/<cmd_name> <col1> <col2>...',

    data: [scb],
    execute: exec,
    settings: settings,
} as Command_t;
