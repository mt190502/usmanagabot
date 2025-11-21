import {
    ActionRowBuilder,
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
import { Cron } from '../../types/decorator/cronjob';
import { SettingChannelMenuComponent, SettingGenericSettingComponent } from '../../types/decorator/settingcomponents';
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

    public async prepareCommandData(guild_id: bigint): Promise<void> {
        this.log.send('debug', 'command.prepare.start', { name: this.name, guild: guild_id });
        const guild = await this.db.getGuild(guild_id);
        const system_user = await this.db.getUser(BigInt(0));
        let earthquake = await this.db.findOne(Earthquake, { where: { from_guild: guild! } });
        if (!earthquake) {
            const new_settings = new Earthquake();
            new_settings.is_enabled = false;
            new_settings.latest_action_from_user = system_user!;
            new_settings.from_guild = guild!;
            earthquake = await this.db.save(new_settings);
            this.log.send('log', 'command.prepare.database.success', { name: this.name, guild: guild_id });
        }
        this.enabled = earthquake.is_enabled;
        this.log.send('debug', 'command.prepare.success', { name: this.name, guild: guild_id });
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    @Cron({ schedule: '*/5 * * * *' })
    public async execute(): Promise<void> {
        this.log.send('debug', 'command.cronjob.start', { name: 'execute' });
        const earthquake = await this.db.find(Earthquake, { where: { is_enabled: true } });
        if (!earthquake || !earthquake.length) {
            this.log.send('debug', 'command.configuration.missing', { name: this.name, guild: 0 });
            return;
        }

        for (const guild of earthquake) {
            if (!guild.channel_id || !guild.seismicportal_api_url) continue;
            const earthquakes = await this.db.find(EarthquakeLogs, { where: { from_guild: guild.from_guild } });
            const request = (await (await fetch(guild.seismicportal_api_url)).json()) as {
                features: {
                    id: string;
                    properties: { time: Date; mag: number; lat: number; lon: number; auth: string };
                }[];
            };

            let recent_earthquakes = request.features.filter((e) => e.properties.mag - guild.magnitude_limit >= 0);
            if (recent_earthquakes.length === 0) continue;

            if (earthquakes.length) {
                recent_earthquakes = recent_earthquakes.filter((e) => earthquakes.find((l) => l.source_id === e.id));
            }
            for (const eq of recent_earthquakes.slice(0, 25)) {
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
        this.log.send('debug', 'command.cronjob.success', { name: 'execute' });
    }
    // ================================================================ //

    // =========================== SETTINGS =========================== //
    @SettingGenericSettingComponent({
        display_name: 'Enabled',
        database: Earthquake,
        database_key: 'is_enabled',
        pretty: 'Toggle Earthquake System',
        description: 'Toggle the earthquake notifier system enabled/disabled.',
        format_specifier: '%s',
    })
    public async toggle(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', { name: this.name, guild: interaction.guild });
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        earthquake!.is_enabled = !earthquake!.is_enabled;
        earthquake!.latest_action_from_user = user;
        earthquake!.timestamp = new Date();
        this.enabled = earthquake!.is_enabled;
        await this.db.save(Earthquake, earthquake!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.toggle.success', {
            name: this.name,
            guild: interaction.guild,
            toggle: this.enabled,
        });
    }

    @SettingChannelMenuComponent({
        display_name: 'Notification Channel',
        database: Earthquake,
        database_key: 'channel_id',
        pretty: 'Set Notification Channel',
        description: 'Set the channel where earthquake notifications will be sent.',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
            placeholder: 'Select a channel for earthquake notifications',
        },
    })
    public async setNotificationChannel(
        interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.setting.channel.start', { name: this.name, guild: interaction.guild });
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        earthquake!.channel_id = interaction.values[0];
        earthquake!.latest_action_from_user = user;
        earthquake!.timestamp = new Date();
        await this.db.save(Earthquake, earthquake!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.channel.success', {
            name: this.name,
            guild: interaction.guild,
            channel: earthquake!.channel_id,
        });
    }

    @SettingGenericSettingComponent({
        display_name: 'Magnitude Limit',
        database: Earthquake,
        database_key: 'magnitude_limit',
        pretty: 'Set Magnitude Limit',
        description: 'Set the minimum magnitude for earthquake notifications.',
        format_specifier: '%s',
    })
    public async setMagnitudeLimit(interaction: StringSelectMenuInteraction, args: string): Promise<void> {
        this.log.send('debug', 'command.setting.selectmenu.start', { name: this.name, guild: interaction.guild });
        const earthquake = (await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        }))!;
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        if (args) {
            earthquake.magnitude_limit = parseFloat(args);
            earthquake!.latest_action_from_user = user;
            earthquake!.timestamp = new Date();
            await this.db.save(Earthquake, earthquake!);
            await this.settingsUI(interaction);
            this.log.send('debug', 'command.setting.selectmenu.success', { name: this.name, guild: interaction.guild });
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

    @SettingGenericSettingComponent({
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
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

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
            earthquake!.latest_action_from_user = user;
            earthquake!.timestamp = new Date();
            await this.db.save(Earthquake, earthquake!);
            await this.settingsUI(interaction);
            this.log.send('debug', 'command.setting.modalsubmit.success', {
                name: this.name,
                guild: interaction.guild,
            });
            return;
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('settings:earthquake:setseismicportalapiurl')
                .setTitle('Set Seismicportal API URL')
                .addComponents([url_input]),
        );
    }

    @SettingGenericSettingComponent({
        display_name: 'Region Code (api-bdc.net)',
        database: Earthquake,
        database_key: 'region_code',
        pretty: 'Set Region Code',
        description: 'Set the region code for earthquake notifications.',
        format_specifier: '`%s`',
    })
    public async setRegionCode(interaction: StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

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
            earthquake!.latest_action_from_user = user;
            earthquake!.timestamp = new Date();
            await this.db.save(Earthquake, earthquake!);
            await this.settingsUI(interaction);
            this.log.send('debug', 'command.setting.modalsubmit.success', {
                name: this.name,
                guild: interaction.guild,
            });
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
