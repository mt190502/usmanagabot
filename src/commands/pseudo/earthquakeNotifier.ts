import {
    ActionRowBuilder,
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
import { BotClient } from '../../services/client';
import { Earthquake, EarthquakeLogs } from '../../types/database/entities/earthquake';
import { CommandSetting } from '../../types/decorator/command';
import { Cron } from '../../types/decorator/cronjob';
import { CustomizableCommand } from '../../types/structure/command';

export default class EarthquakeNotifierCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'earthquake',
            pretty_name: 'Earthquake Notifier',
            description: 'Notifies about earthquakes at scheduled intervals.',
            help: `
                This command periodically checks for earthquake data and sends notifications to subscribed channels.
            `,
        });
        this.base_cmd_data = null;
    }

    public async generateSlashCommandData(guild_id: bigint): Promise<void> {
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let earthquake = await this.db.findOne(Earthquake, { where: { from_guild: guild! } });
        if (!earthquake) {
            const new_settings = new Earthquake();
            new_settings.is_enabled = false;
            new_settings.latest_action_from_user = system_user!;
            new_settings.from_guild = guild!;
            earthquake = await this.db.save(new_settings);
        }
        this.enabled = earthquake.is_enabled;
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @Cron({ schedule: '*/5 * * * *' })
    public async execute(): Promise<void> {
        const earthquake = await this.db.find(Earthquake, { where: { is_enabled: true } });
        if (!earthquake || !earthquake.length) return;

        for (const guild of earthquake) {
            if (!guild.channel_id || !guild.seismicportal_api_url) continue;
            const earthquakes = await this.db.find(EarthquakeLogs, { where: { from_guild: guild.from_guild } });
            const request = (await (await fetch(guild.seismicportal_api_url)).json()) as {
                features: {
                    id: string;
                    properties: { time: Date; mag: number; lat: number; lon: number; auth: string };
                }[];
            };
            for (const eq of request.features.slice(0, 20)) {
                const recent_earthquakes = request.features.filter((e) => e.properties.mag >= guild.magnitude_limit);
                if (earthquakes.length) {
                    recent_earthquakes.filter((e) => earthquakes.find((l) => l.source_id === e.id) === undefined);
                }
                if (recent_earthquakes.length === 0) continue;

                const existing_log = await this.db.findOne(EarthquakeLogs, {
                    where: { source_id: eq.id, from_guild: guild.from_guild },
                });
                if (existing_log?.is_delivered) continue;

                const geo_translate = (
                    (await (
                        await fetch(
                            `https://us1.api-bdc.net/data/reverse-geocode-client?latitude=${eq.properties.lat}&longitude=${eq.properties.lon}&localityLanguage=${guild.region_code}`,
                        )
                    ).json()) as { locality: string }
                ).locality;

                const post = new EmbedBuilder();
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
                        value: geo_translate || 'Unknown',
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
                    },
                );
                const channel = await BotClient.client.guilds
                    .fetch(guild.from_guild.gid.toString())
                    .then((g) => g.channels.fetch(guild.channel_id!));
                if (channel && channel.isTextBased()) {
                    const old_logs = await this.db.find(EarthquakeLogs, {
                        where: { from_guild: guild.from_guild },
                        order: { timestamp: 'DESC' },
                    });
                    if (old_logs.length > 50) {
                        for (const old_log of old_logs.slice(50)) await this.db.remove(old_log);
                    }

                    const logs = new EarthquakeLogs();
                    logs.source_id = eq.id;
                    logs.source_name = eq.properties.auth;
                    logs.from_guild = guild.from_guild;
                    await channel
                        .send({ embeds: [post] })
                        .then(() => {
                            logs.is_delivered = true;
                        })
                        .catch(() => {
                            logs.is_delivered = false;
                        });
                    await this.db.save(logs);
                }
            }
        }
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @CommandSetting({
        display_name: 'Enabled',
        database: Earthquake,
        database_key: 'is_enabled',
        pretty: 'Toggle Earthquake System',
        description: 'Toggle the earthquake notifier system enabled/disabled.',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        earthquake!.is_enabled = !earthquake!.is_enabled;
        this.enabled = earthquake!.is_enabled;
        await this.db.save(Earthquake, earthquake!);
        await this.settingsUI(interaction);
    }

    @CommandSetting({
        display_name: 'Notification Channel',
        database: Earthquake,
        database_key: 'channel_id',
        pretty: 'Set Notification Channel',
        description: 'Set the channel where earthquake notifications will be sent.',
        format_specifier: '<#%s>',
    })
    public async setNotificationChannel(
        interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    ): Promise<void> {
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });

        if (interaction.isChannelSelectMenu()) {
            const channel_id = interaction.values[0];
            earthquake!.channel_id = channel_id;
            await this.db.save(Earthquake, earthquake!);
            await this.settingsUI(interaction);
        }
        if (interaction.isStringSelectMenu()) {
            await interaction.update({
                components: [
                    new ActionRowBuilder<ChannelSelectMenuBuilder>()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId('settings:earthquake:setnotificationchannel')
                                .setPlaceholder('Select a channel')
                                .setChannelTypes(ChannelType.GuildText),
                        )
                        .toJSON(),
                ],
            });
        }
    }

    @CommandSetting({
        display_name: 'Magnitude Limit',
        database: Earthquake,
        database_key: 'magnitude_limit',
        pretty: 'Set Magnitude Limit',
        description: 'Set the minimum magnitude for earthquake notifications.',
        format_specifier: '%s',
    })
    public async setMagnitudeLimit(interaction: StringSelectMenuInteraction, args: string): Promise<void> {
        const earthquake = (await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        }))!;

        if (args) {
            earthquake.magnitude_limit = parseFloat(args);
            await this.db.save(Earthquake, earthquake!);
            await this.settingsUI(interaction);
            return;
        }

        await interaction.update({
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('settings:earthquake:setmagnitude')
                            .setPlaceholder('Select a magnitude')
                            .addOptions(
                                ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'].map((magnitude) => ({
                                    label: magnitude,
                                    value: `settings:earthquake:setmagnitudelimit:${magnitude}`,
                                })),
                            ),
                    )
                    .toJSON(),
            ],
        });
    }

    @CommandSetting({
        display_name: 'Seismicportal API URL',
        database: Earthquake,
        database_key: 'seismicportal_api_url',
        pretty: 'Set Seismicportal API URL',
        description: 'Set the API URL for fetching earthquake data from Seismicportal.',
        format_specifier: '[API URL](%s)',
    })
    public async setSeismicportalApiUrl(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    ): Promise<void> {
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const url_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('seismicportal_api_url_input')
                .setLabel('Seismicportal API URL')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the Seismicportal API URL')
                .setRequired(true)
                .setMaxLength(300),
        );

        if (interaction.isModalSubmit()) {
            const api_url = interaction.fields.getTextInputValue('seismicportal_api_url_input');
            earthquake!.seismicportal_api_url = api_url;
            await this.db.save(Earthquake, earthquake!);
            await this.settingsUI(interaction);
            return;
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('settings:earthquake:setseismicportalapiurl')
                .setTitle('Set Seismicportal API URL')
                .addComponents([url_input]),
        );
    }

    @CommandSetting({
        display_name: 'Region Code (api-bdc.net)',
        database: Earthquake,
        database_key: 'region_code',
        pretty: 'Set Region Code',
        description: 'Set the region code for earthquake notifications.',
        format_specifier: '`%s`',
    })
    public async setRegionCode(interaction: StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });

        const region_code_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('region_code_input')
                .setLabel('Region Code')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the region code (e.g., en, de, tr)')
                .setRequired(true)
                .setMaxLength(5),
        );

        if (interaction.isModalSubmit()) {
            const region_code = interaction.fields.getTextInputValue('region_code_input');
            earthquake!.region_code = region_code;
            await this.db.save(Earthquake, earthquake!);
            await this.settingsUI(interaction);
            return;
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('settings:earthquake:setregioncode')
                .setTitle('Set Region Code')
                .addComponents([region_code_input]),
        );
    }
    // ================================================================ //
}
