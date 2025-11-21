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
        super({ name: 'settings', is_admin_command: true });
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
            title: `:gear: ${this.t('settings.pretty_name')}`,
            color: Colors.Blurple,
            items: commands
                .sort((a, b) => a[1].pretty_name.localeCompare(b[1].pretty_name))
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
        super({ name: 'botsettings', is_admin_command: true, is_bot_owner_command: true });
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
        database: BotData,
        database_key: 'enable_random_status',
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
        database: BotData,
        database_key: 'random_status_interval',
        format_specifier: '%d',
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
                            .setPlaceholder(this.t('botsettings.settings.setrandomstatusinterval.placeholder'))
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
        database: BotData,
        database_key: 'random_statuses',
        db_column_is_array: true,
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
                .setLabel(this.t('botsettings.settings.managerandomstatuses.placeholder'))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(settings!.random_statuses.join(', '))
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
                .setTitle(this.t('botsettings.settings.managerandomstatuses.pretty_name'))
                .addComponents([random_status_input]),
        );
    }
    // ================================================================ //
}

export default [BotSettings, SettingsCommand];
