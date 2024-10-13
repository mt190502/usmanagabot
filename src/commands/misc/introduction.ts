import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChannelSelectMenuBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    ColorResolvable,
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
    try {
        const introduction = await DatabaseConnection.manager.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        });

        if (!introduction) {
            const new_introduction = new Introduction();
            new_introduction.cmd_name = 'introduction';
            new_introduction.cmd_desc = 'User introduction database';
            new_introduction.from_guild = await DatabaseConnection.manager.findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            });
            new_introduction.from_user = await DatabaseConnection.manager.findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            });
            await DatabaseConnection.manager.save(new_introduction);
            return settings(interaction);
        }

        const cmd_name = new TextInputBuilder()
            .setCustomId('cmd_name')
            .setLabel('Command Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(introduction.cmd_name);
        const cmd_desc = new TextInputBuilder()
            .setCustomId('cmd_desc')
            .setLabel('Command Description')
            .setPlaceholder(introduction.cmd_desc)
            .setStyle(TextInputStyle.Short);
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
                await DatabaseConnection.manager.save(introduction);
                await (interaction as StringSelectMenuInteraction).update({
                    content: `Introduction system ${introduction.is_enabled ? 'enabled' : 'disabled'}`,
                    components: [genMenuOptions()],
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
                        .addComponents(
                            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(column_names)
                        )
                );
                break;
            case '4':
                await (interaction as StringSelectMenuInteraction).update({
                    content: 'Select a channel',
                    components: [
                        new ActionRowBuilder()
                            .addComponents(channel_select_menu)
                            .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                    ],
                });
                break;
            case '21':
                introduction.cmd_name = (interaction as ModalSubmitInteraction).fields
                    .getTextInputValue('cmd_name')
                    .replaceAll(/\s/g, '_')
                    .replaceAll(/\W/g, '')
                    .toLowerCase();
                introduction.cmd_desc = (interaction as ModalSubmitInteraction).fields.getTextInputValue('cmd_desc');
                await DatabaseConnection.manager.save(introduction);
                await (interaction as StringSelectMenuInteraction).update({
                    content: `Command name set to ${introduction.cmd_name} and description set to ${introduction.cmd_desc}`,
                    components: [genMenuOptions()],
                });
                await RESTCommandLoader(introduction.from_guild.gid);
                break;
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
                            content: `Duplicate column name detected: ${column.name}`,
                            ephemeral: true,
                        });
                        return;
                    }
                    namesSet.add(column.name);
                }

                for (let i = 0; i < parsed.length; i++) {
                    (introduction[`col${i + 1}` as keyof Introduction] as string[]) = [parsed[i].name, parsed[i].value];
                }

                introduction.yaml_data = columns;
                await DatabaseConnection.manager.save(introduction);
                await (interaction as StringSelectMenuInteraction).update({
                    content: 'Column names updated successfully',
                    components: [genMenuOptions()],
                });
                await RESTCommandLoader(introduction.from_guild.gid);
                break;
            }
            case '41':
                introduction.channel_id = (interaction as StringSelectMenuInteraction).values[0];
                await DatabaseConnection.manager.save(introduction);
                await (interaction as StringSelectMenuInteraction).update({
                    content: `Introduction channel set to <#${introduction.channel_id}>`,
                    components: [genMenuOptions()],
                });
                break;
            default:
                await (interaction as StringSelectMenuInteraction).update({
                    content: 'Introduction Settings',
                    components: [genMenuOptions()],
                });
        }
    } catch (error) {
        Logger('error', error);
    }
};

const exec = async (interaction: ChatInputCommandInteraction) => {
    try {
        const introduction = await DatabaseConnection.manager.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        });
        const introduction_submit = await DatabaseConnection.manager.findOne(IntroductionSubmit, {
            where: { from_user: { uid: BigInt(interaction.user.id) } },
        });

        if (introduction_submit && new Date().getTime() - introduction_submit.timestamp.getTime() < 86400000) {
            await interaction.reply({
                content: 'You have already submitted an introduction today. Please try again tomorrow.',
                ephemeral: true,
            });
            return;
        }

        if (!introduction || !introduction.is_enabled || !introduction.channel_id) {
            await interaction.reply({
                content:
                    'Introduction system is not set up properly or is disabled. Please contact the server administrator.',
                ephemeral: true,
            });
            return;
        }

        const user_roles = interaction.guild.members.cache.get(interaction.user.id).roles.cache;
        const data = [`**__About ${interaction.user.username}__**\n`];

        for (let i = 1; i <= 8; i++) {
            const key = introduction[`col${i}` as keyof Introduction];
            if (Array.isArray(key)) {
                const value = interaction.options.getString(key[0]);
                if (value) data.push(`**${key[1]}**: ${value}\n`);
            }
        }

        data.push(
            '\n**__Account Information__**\n',
            `**Username**: ${interaction.user.username}\n`,
            `**Nickname**: <@!${interaction.user.id}>\n`,
            `**ID**: ${interaction.user.id}\n`,
            `**Created At**: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>\n`,
            `**Joined At**: <t:${Math.floor(interaction.guild.members.cache.get(interaction.user.id).joinedTimestamp / 1000)}:R>\n`,
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

        if (introduction_submit) embed.setFooter({ text: 'Introduction Updated' });

        const target_channel = interaction.guild.channels.cache.get(introduction.channel_id) as TextChannel;
        const publish = await target_channel.send({
            content: `<@${interaction.user.id}>`,
            embeds: [embed],
        });

        if (introduction_submit) {
            const old_message = await target_channel.messages.fetch(
                introduction_submit.last_submit_url.split('/').at(-1)
            );
            await old_message.delete();
            introduction_submit.last_submit_url = publish.url;
            introduction_submit.timestamp = new Date();
            await DatabaseConnection.manager.save(introduction_submit);
        } else {
            const new_introduction_submit = new IntroductionSubmit();
            new_introduction_submit.from_guild = await DatabaseConnection.manager.findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            });
            new_introduction_submit.from_user = await DatabaseConnection.manager.findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            });
            new_introduction_submit.last_submit_url = publish.url;
            new_introduction_submit.timestamp = new Date();
            await DatabaseConnection.manager.save(new_introduction_submit);
        }

        await interaction.reply({
            content: `Introduction sent successfully!\n[View Message](${publish.url})`,
            ephemeral: true,
        });
    } catch (error) {
        Logger('error', error, interaction);
    }
};

const scb = async (guild: Guilds): Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>> => {
    try {
        const introduction = await DatabaseConnection.manager.findOne(Introduction, {
            where: { from_guild: { gid: BigInt(guild.gid) } },
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
            data.addStringOption((option) =>
                option
                    .setName((introduction[colName] as string[])[0])
                    .setDescription((introduction[colName] as string[])[1])
            );
        }
        return data;
    } catch (error) {
        Logger('error', error);
        return null;
    }
};

export default {
    enabled: true,
    name: 'introduction',
    type: 'customizable',

    description: 'User introduction database',
    category: 'misc',
    cooldown: 5,
    usage: '/<cmd_name> <col1> <col2> <col3> <col4> <col5> <col6> <col7> <col8>',

    data: [scb],
    execute: exec,
    settings: settings,
} as Command_t;
