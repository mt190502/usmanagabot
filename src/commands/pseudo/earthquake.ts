import {
    ActionRowBuilder,
    APIActionRowComponent,
    APIMessageActionRowComponent,
    ChannelSelectMenuBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    Colors,
    EmbedBuilder,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { BotClient, DatabaseConnection } from '../../main';
import { Earthquake } from '../../types/database/earthquake';
import { EarthquakeLogs } from '../../types/database/earthquake_logs';
import { Guilds } from '../../types/database/guilds';
import { Users } from '../../types/database/users';
import { Command_t } from '../../types/interface/commands';
import { Logger } from '../../utils/logger';

const intervals = new Map<string, NodeJS.Timeout>();

const settings = async (
    interaction: StringSelectMenuInteraction | ModalSubmitInteraction | ChannelSelectMenuInteraction
) => {
    const earthquake = await DatabaseConnection.manager
        .findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guild.id) } },
        })
        .catch((err) => {
            Logger('error', err, interaction);
            throw err;
        });

    if (!earthquake) {
        const new_earthquake = new Earthquake();
        new_earthquake.from_guild = await DatabaseConnection.manager
            .findOne(Guilds, {
                where: { gid: BigInt(interaction.guild.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        new_earthquake.latest_action_from_user = await DatabaseConnection.manager
            .findOne(Users, {
                where: { uid: BigInt(interaction.user.id) },
            })
            .catch((err) => {
                Logger('error', err, interaction);
                throw err;
            });
        await DatabaseConnection.manager.save(new_earthquake).catch((err) => {
            Logger('error', err, interaction);
        });
        return settings(interaction);
    }

    let status = earthquake.is_enabled ? 'Disable' : 'Enable';
    const channel_select_menu = new ChannelSelectMenuBuilder()
        .setCustomId('settings:earthquake:21')
        .setPlaceholder('Select a channel')
        .setChannelTypes(ChannelType.GuildText);
    const magnitude = new TextInputBuilder()
        .setCustomId('magnitude')
        .setLabel('Earthquake Magnitude Limit')
        .setPlaceholder('3.0')
        .setValue(earthquake.magnitude_limit ? `${earthquake.magnitude_limit}` : '')
        .setStyle(TextInputStyle.Short);
    const check_interval = new TextInputBuilder()
        .setCustomId('check_interval')
        .setLabel('Check Interval (in minutes)')
        .setPlaceholder('1')
        .setValue(earthquake.check_interval ? `${earthquake.check_interval}` : '')
        .setStyle(TextInputStyle.Short);
    const seismic_portal_api_url = new TextInputBuilder()
        .setCustomId('seismic_portal_api_url')
        .setLabel('SeismicPortal API URL')
        .setPlaceholder('https://www.seismicportal.eu/fdsnws/event/1/query?.....')
        .setValue(earthquake.seismic_portal_api_url ? earthquake.seismic_portal_api_url : '')
        .setStyle(TextInputStyle.Short);

    const genPostEmbed = (warn?: string): EmbedBuilder => {
        const post = new EmbedBuilder().setTitle(':gear: Earthquake Notifier Settings');
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
                value: earthquake.is_enabled ? ':green_circle: True' : ':red_circle: False',
            },
            {
                name: 'Channel',
                value: earthquake.channel_id ? `<#${earthquake.channel_id}>` : 'Not set',
            },
            {
                name: 'Magnitude Limit (>= limit)',
                value: earthquake.magnitude_limit ? `${earthquake.magnitude_limit}` : 'Not set',
            },
            {
                name: 'SeismicPortal API URL',
                value: earthquake.seismic_portal_api_url ? earthquake.seismic_portal_api_url : 'Not set',
            },
            {
                name: 'Check Interval (in minutes)',
                value: earthquake.check_interval.toString(),
            }
        );

        post.addFields(fields);
        return post;
    };

    const genMenuOptions = (): APIActionRowComponent<APIMessageActionRowComponent> => {
        const menu = new StringSelectMenuBuilder().setCustomId('settings:earthquake:0').addOptions([
            {
                label: `${status} Earthquake Notifier System`,
                description: `${status} the earthquake notifier system`,
                value: 'settings:earthquake:1',
            },
            {
                label: 'Change Earthquake Notifier Channel',
                description: 'Change the channel for the earthquake notifier',
                value: 'settings:earthquake:2',
            },
            {
                label: 'Change Earthquake Magnitude',
                description: 'Change the magnitude for the earthquake notifier',
                value: 'settings:earthquake:3',
            },
            {
                label: 'Change SeismicPortal API URL',
                description: 'Change the SeismicPortal API URL',
                value: 'settings:earthquake:4',
            },
            {
                label: 'Change Check Interval',
                description: 'Change the check interval for the earthquake notifier',
                value: 'settings:earthquake:5',
            },
            { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
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
            earthquake.is_enabled = !earthquake.is_enabled;
            status = earthquake.is_enabled ? 'Disable' : 'Enable';
            await DatabaseConnection.manager.save(earthquake).catch((err) => {
                Logger('error', err, interaction);
            });
            if (earthquake.is_enabled) {
                await exec('ready', interaction.guild.id);
            } else {
                const interval = intervals.get(interaction.guild.id);
                if (interval) {
                    clearInterval(interval);
                    intervals.delete(interaction.guild.id);
                }
            }
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        case '2':
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [
                    new ActionRowBuilder()
                        .addComponents(channel_select_menu)
                        .toJSON() as APIActionRowComponent<APIMessageActionRowComponent>,
                ],
            });
            break;
        case '3':
            await (interaction as StringSelectMenuInteraction).showModal(
                new ModalBuilder()
                    .setCustomId('settings:earthquake:31')
                    .setTitle('Change Earthquake Magnitude')
                    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(magnitude))
            );
            break;
        case '4':
            await (interaction as StringSelectMenuInteraction).showModal(
                new ModalBuilder()
                    .setCustomId('settings:earthquake:41')
                    .setTitle('Change SeismicPortal API URL')
                    .addComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(seismic_portal_api_url)
                    )
            );
            break;
        case '5':
            await (interaction as StringSelectMenuInteraction).showModal(
                new ModalBuilder()
                    .setCustomId('settings:earthquake:51')
                    .setTitle('Change Check Interval')
                    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(check_interval))
            );
            break;
        case '21':
            earthquake.channel_id = (interaction as StringSelectMenuInteraction).values[0];
            await DatabaseConnection.manager.save(earthquake).catch((err) => {
                Logger('error', err, interaction);
            });
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        case '31': {
            const magnitude_value = parseFloat(
                (interaction as ModalSubmitInteraction).fields.getTextInputValue('magnitude')
            );
            if (isNaN(magnitude_value)) {
                await (interaction as StringSelectMenuInteraction).update({
                    embeds: [genPostEmbed('Invalid Magnitude Value')],
                    components: [genMenuOptions()],
                });
                return;
            }
            earthquake.magnitude_limit = magnitude_value;
            await DatabaseConnection.manager.save(earthquake).catch((err) => {
                Logger('error', err, interaction);
            });
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        }
        case '41':
            earthquake.seismic_portal_api_url = (interaction as ModalSubmitInteraction).fields.getTextInputValue(
                'seismic_portal_api_url'
            );
            await DatabaseConnection.manager.save(earthquake).catch((err) => {
                Logger('error', err, interaction);
            });
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        case '51': {
            const check_interval_value = parseInt(
                (interaction as ModalSubmitInteraction).fields.getTextInputValue('check_interval')
            );
            if (isNaN(check_interval_value)) {
                await (interaction as StringSelectMenuInteraction).update({
                    embeds: [genPostEmbed('Invalid Check Interval Value')],
                    components: [genMenuOptions()],
                });
                return;
            }
            earthquake.check_interval = check_interval_value;
            await DatabaseConnection.manager.save(earthquake).catch((err) => {
                Logger('error', err, interaction);
            });
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
        }
        default:
            await (interaction as StringSelectMenuInteraction).update({
                embeds: [genPostEmbed()],
                components: [genMenuOptions()],
            });
            break;
    }
};

const exec = async (event_name: string, gid: string) => {
    const existing_interval = intervals.get(gid);
    if (existing_interval) return;
    const earthquake = await DatabaseConnection.manager
        .findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(gid) } },
        })
        .catch((err) => {
            Logger('error', err);
            throw err;
        });
    const guild = await DatabaseConnection.manager
        .findOne(Guilds, {
            where: { gid: BigInt(gid) },
        })
        .catch((err) => {
            Logger('error', err);
            throw err;
        });
    if (!earthquake) return;

    if (earthquake.is_enabled) {
        if (!earthquake.channel_id) {
            Logger('warn', `Earthquake Notifier is enabled but no channel is set for guild ${gid}`);
            return;
        }
        if (!earthquake.seismic_portal_api_url) {
            Logger('warn', `Earthquake Notifier is enabled but no SeismicPortal API URL is set for guild ${gid}`);
            return;
        }

        const new_interval = setInterval(
            async () => {
                const logs = await DatabaseConnection.manager
                    .find(EarthquakeLogs, {
                        where: { from_guild: { gid: BigInt(gid) } },
                    })
                    .catch((err) => {
                        Logger('error', err);
                        throw err;
                    });
                const response = await fetch(earthquake.seismic_portal_api_url);
                const data = (await response.json()) as {
                    features: {
                        id: string;
                        properties: { time: Date; mag: number; lat: number; lon: number; auth: string };
                    }[];
                };
                const earthquakes = data.features
                    .filter((eq) => eq.properties.mag >= earthquake.magnitude_limit)
                    .filter((eq) => logs.find((log) => log.source_id === eq.id) === undefined);
                if (earthquakes.length > 0) {
                    for (const eq of earthquakes.slice(0, 5)) {
                        const post = new EmbedBuilder();
                        const geo_response = (await (
                            await fetch(
                                `https://us1.api-bdc.net/data/reverse-geocode-client?latitude=${eq.properties.lat}&longitude=${eq.properties.lon}&localityLanguage=tr`
                            )
                        ).json()) as { locality: string };
                        const location_name = geo_response.locality;
                        post.setTitle(':warning: New Earthquake Alert');
                        post.setColor(Colors.Yellow);
                        post.setTimestamp();
                        post.addFields(
                            {
                                name: 'Time',
                                value: new Date(eq.properties.time).toLocaleString(),
                                inline: true,
                            },
                            {
                                name: 'ID',
                                value: eq.id,
                                inline: true,
                            },
                            {
                                name: 'Location',
                                value: location_name,
                                inline: true,
                            },
                            {
                                name: 'Source',
                                value: eq.properties.auth,
                                inline: true,
                            },
                            {
                                name: 'Magnitude',
                                value: eq.properties.mag.toString(),
                                inline: true,
                            },
                            {
                                name: 'Coordinates',
                                value: `Latitude: ${eq.properties.lat}\nLongitude: ${eq.properties.lon}`,
                                inline: true,
                            },
                            {
                                name: 'Link',
                                value: `https://www.seismicportal.eu/eventdetails.html?unid=${eq.id}`,
                            },
                            {
                                name: 'Other Earthquakes',
                                value: 'https://deprem.core.xeome.dev',
                            }
                        );
                        const channel = await BotClient.guilds.fetch(gid).then((g) => {
                            return g.channels.fetch(earthquake.channel_id);
                        });
                        if (channel && channel.isTextBased()) {
                            const log = new EarthquakeLogs();
                            log.source_name = eq.properties.auth;
                            log.source_id = eq.id;
                            log.from_guild = guild;
                            try {
                                await DatabaseConnection.manager.save(log);
                                channel.send({ embeds: [post] });
                            } catch (err) {
                                Logger('error', `Failed to save earthquake log for ID ${eq.id}: ${err}`);
                            }
                        } else {
                            Logger('warn', `Channel ${earthquake.channel_id} in guild ${gid} is not a text channel`);
                        }
                    }
                }
            },
            earthquake.check_interval * 1000 * 60
        );
        intervals.set(gid, new_interval);
    }
};

export default {
    enabled: true,
    name: 'earthquake',
    type: 'customizable',
    description: 'Earthquake Notifier',

    category: 'pseudo',

    usewithevent: ['ready'],
    execute_when_event: exec,
    settings: settings,
} as Command_t;
