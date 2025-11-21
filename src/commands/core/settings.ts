import {
    ActionRowBuilder,
    Colors,
    CommandInteraction,
    Interaction,
    MessageFlags,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { CommandLoader } from '..';
import { BotData } from '../../types/database/entities/bot';
import { SettingGenericSettingComponent } from '../../types/decorator/settingcomponents';
import { BaseCommand, CustomizableCommand } from '../../types/structure/command';

class SettingsCommand extends BaseCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'settings',
            pretty_name: 'Settings',
            description: 'Manage modules and bot settings.',
            is_admin_command: true,
            help: 'Use this command to manage various modules and settings of the bot.',
        });
        this.base_cmd_data!.setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers,
        );
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    public async execute(interaction: Interaction | CommandInteraction | StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.execute.start', {
            name: this.name,
            guild: interaction.guild,
            user: interaction.user,
        });
        this.log.send('debug', 'command.settings.execute.generating_page', {
            guild: interaction.guild,
            user: interaction.user,
        });
        const commands = Array.from(CommandLoader.BotCommands.get(interaction.guild!.id)!);
        const payload = await this.paginator.generatePage(interaction.guild!.id, interaction.user.id, this.name, {
            title: ':gear: Settings - Configurable Modules & Settings',
            color: Colors.Blurple,
            items: commands
                .sort((a, b) => a[0].localeCompare(b[0]))
                .filter(([, cmd]) =>
                    cmd.is_bot_owner_command
                        ? interaction.guildId === this.cfg.current_botcfg.management.guild_id &&
                          interaction.user.id === this.cfg.current_botcfg.management.user_id
                        : true,
                )
                .map(([, cmd]) => ({
                    name: cmd.name,
                    pretty_name: cmd.pretty_name,
                    description: cmd.description,
                    namespace: 'settings' as const,
                })),
            items_per_page: 5,
        });
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            await interaction.update({
                embeds: payload.embeds,
                components: payload.components,
            });
            return;
        } else if (interaction.isCommand()) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: payload.embeds,
                components: payload.components,
            });
            this.log.send('debug', 'command.execute.success', {
                name: this.name,
                guild: interaction.guild,
                user: interaction.user,
            });
            return;
        }
    }
    // ================================================================ //
}

class BotSettings extends CustomizableCommand {
    // ============================ HEADER ============================ //
    constructor() {
        super({
            name: 'botsettings',
            pretty_name: 'Bot Settings',
            description: 'Manage bot-wide settings.',
            is_admin_command: true,
            is_bot_owner_command: true,
        });
        this.base_cmd_data = null;
    }

    public async prepareCommandData(): Promise<void> {
        const settings = await this.db.findOne(BotData, { where: { id: 1 } });
        if (!settings) {
            const new_data = new BotData();
            new_data.id = 1;
            new_data.enable_random_status = true;
            new_data.random_status_interval = 60;
            new_data.random_statuses = ['YouTube', 'Akasya Durağı', 'Kurtlar Vadisi'];
            await this.db.save(new_data);
        }
        return;
    }
    // ================================================================ //

    // =========================== EXECUTE ============================ //
    public async execute(): Promise<void> {
        return;
    }
    // ================================================================ //

    // ========================== SETTINGS ============================ //
    @SettingGenericSettingComponent({
        display_name: 'Enable Random Status',
        database: BotData,
        database_key: 'enable_random_status',
        pretty: 'Toggle Random Status',
        description: 'Toggle whether the bot should cycle through random statuses.',
        format_specifier: '%s',
        is_bot_owner_only: true,
    })
    public async toggleRandomStatus(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log.send('debug', 'command.setting.toggle.start', {
            name: this.name,
            guild: interaction.guild,
        });
        const settings = await this.db.findOne(BotData, { where: { id: 1 } });

        settings!.enable_random_status = !settings!.enable_random_status;
        await this.db.save(settings!);
        await this.settingsUI(interaction);
        return;
    }

    @SettingGenericSettingComponent({
        display_name: 'Random Status Interval (minutes)',
        pretty: 'Random Status Interval',
        database: BotData,
        database_key: 'random_status_interval',
        description: 'Set the interval (in minutes) for changing random statuses.',
        format_specifier: '%d minutes',
        is_bot_owner_only: true,
    })
    public async setRandomStatusInterval(interaction: StringSelectMenuInteraction, args: string): Promise<void> {
        this.log.send('debug', 'command.setting.selectmenu.start', { name: this.name, guild: interaction.guild });
        const settings = (await this.db.findOne(BotData, {
            where: { id: 1 },
        }))!;

        if (args) {
            settings.random_status_interval = parseFloat(args);
            await this.db.save(settings!);
            await this.settingsUI(interaction);
            this.log.send('debug', 'command.setting.selectmenu.success', { name: this.name, guild: interaction.guild });
            return;
        }

        await interaction.update({
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('settings:botsettings:setrandomstatusinterval')
                            .setPlaceholder('Select a random status interval (in minutes)')
                            .addOptions(
                                [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((min) => ({
                                    label: min.toString(),
                                    value: `settings:botsettings:setrandomstatusinterval:${min}`,
                                })),
                            ),
                    )
                    .toJSON(),
            ],
        });
    }

    @SettingGenericSettingComponent({
        display_name: 'Random Statuses',
        pretty: 'Random Statuses',
        database: BotData,
        database_key: 'random_statuses',
        db_column_is_array: true,
        description: 'Manage the list of random statuses the bot will cycle through (comma seperated).',
        format_specifier: '`%s`',
        is_bot_owner_only: true,
    })
    public async manageRandomStatuses(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    ): Promise<void> {
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const settings = await this.db.findOne(BotData, { where: { id: 1 } });

        const random_status_input = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('bot_random_statuses_input')
                .setLabel('Random Statuses (comma separated)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the Random Statuses here, separated by commas')
                .setRequired(true)
                .setMaxLength(300),
        );

        if (interaction.isModalSubmit()) {
            const statuses = interaction.fields.getTextInputValue('bot_random_statuses_input');
            settings!.random_statuses = statuses.split(',').map((s) => s.trim());
            await this.db.save(settings!);
            await this.settingsUI(interaction);
            this.log.send('debug', 'command.setting.modalsubmit.success', {
                name: this.name,
                guild: interaction.guild,
            });
            return;
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('settings:botsettings:managerandomstatuses')
                .setTitle('Set Random Statuses')
                .addComponents([random_status_input]),
        );
    }
    // ================================================================ //
}

export default [BotSettings, SettingsCommand];
