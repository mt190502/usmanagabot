import {
    ActionRowBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    Colors,
    EmbedBuilder,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputStyle,
} from 'discord.js';
import { BotClient } from '../../services/client';
import { Earthquake, EarthquakeLogs } from '../../types/database/entities/earthquake';
import { Cron } from '../../types/decorator/cronjob';
import {
    SettingChannelMenuComponent,
    SettingGenericSettingComponent,
    SettingModalComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

export default class EarthquakeNotifierCommand extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({ name: 'earthquake' });
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
                post.setTitle(`:warning: ${this.t('execute.title')}`);
                post.setColor(Colors.Yellow);
                post.setTimestamp();
                post.addFields(
                    {
                        name: this.t('execute.time'),
                        value: new Date(eq.properties.time).toLocaleString(),
                        inline: true,
                    },
                    {
                        name: this.t('execute.id'),
                        value: eq.id,
                        inline: true,
                    },
                    {
                        name: this.t('execute.location'),
                        value: geo_translate || 'Unknown',
                        inline: true,
                    },
                    {
                        name: this.t('execute.source'),
                        value: eq.properties.auth,
                        inline: true,
                    },
                    {
                        name: this.t('execute.magnitude'),
                        value: eq.properties.mag.toString(),
                        inline: true,
                    },
                    {
                        name: this.t('execute.coordinates'),
                        value: `Latitude: ${eq.properties.lat}\nLongitude: ${eq.properties.lon}`,
                        inline: true,
                    },
                    {
                        name: this.t('execute.link'),
                        value: `https://www.seismicportal.eu/eventdetails.html?unid=${eq.id}`,
                    },
                    {
                        name: this.t('execute.other_earthquakes'),
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
        database: Earthquake,
        database_key: 'is_enabled',
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
        database: Earthquake,
        database_key: 'channel_id',
        format_specifier: '<#%s>',
        options: {
            channel_types: [ChannelType.GuildText],
        },
    })
    public async setNotificationChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
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
        database: Earthquake,
        database_key: 'magnitude_limit',
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
                            .setPlaceholder(this.t('settings.setmagnitudelimit.placeholder'))
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

    @SettingModalComponent({
        database: Earthquake,
        database_key: 'seismicportal_api_url',
        format_specifier: '[API URL](%s)',
        inputs: [
            {
                id: 'seismicportal_api_url',
                style: TextInputStyle.Short,
                required: true,
                max_length: 300,
            },
        ],
    })
    public async setSeismicportalApiUrl(interaction: ModalSubmitInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const api_url = interaction.fields.getTextInputValue('seismicportal_api_url');
        if (!api_url.match(/^https?:\/\/(www\.)?seismicportal\.eu\/fdsnws\/event\/1\/query.*/)) {
            this.log.send('debug', 'command.earthquake.settings.invalid_url', {
                guild: interaction.guild,
                user: interaction.user,
                url: api_url,
            });
            this.warning = this.t('settings.setseismicportalapiurl.invalid_url');
            await this.settingsUI(interaction);
            return;
        }

        earthquake!.seismicportal_api_url = api_url;
        earthquake!.latest_action_from_user = user;
        earthquake!.timestamp = new Date();
        await this.db.save(Earthquake, earthquake!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.modalsubmit.success', {
            name: this.name,
            guild: interaction.guild,
        });
    }

    @SettingModalComponent({
        database: Earthquake,
        database_key: 'region_code',
        format_specifier: '`%s`',
        inputs: [
            {
                id: 'region_code',
                style: TextInputStyle.Short,
                required: true,
                max_length: 5,
            },
        ],
    })
    public async setRegionCode(interaction: ModalSubmitInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const earthquake = await this.db.findOne(Earthquake, {
            where: { from_guild: { gid: BigInt(interaction.guildId!) } },
        });
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;

        const region_code = interaction.fields.getTextInputValue('region_code');
        earthquake!.region_code = region_code;
        earthquake!.latest_action_from_user = user;
        earthquake!.timestamp = new Date();
        await this.db.save(Earthquake, earthquake!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.modalsubmit.success', {
            name: this.name,
            guild: interaction.guild,
        });
    }
    // ================================================================ //
}
