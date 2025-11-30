import { ModalSubmitInteraction, StringSelectMenuInteraction, TextInputStyle } from 'discord.js';
import { BotData } from '../../types/database/entities/bot';
import {
    SettingGenericSettingComponent,
    SettingModalComponent,
    SettingStringSelectComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

/**
 * A "hidden" command that serves as a settings container for global, bot-owner-only configurations.
 *
 * This command is not invokable as a slash command (`base_cmd_data` is null). Instead, its settings
 * are displayed within the main `/settings` command UI, but are only visible to the user specified
 * as the bot owner in the configuration. It manages settings like the bot's random status presence.
 */
export default class BotSettings extends CustomizableCommand {
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
    /**
     * The execute method is intentionally left empty.
     * This command cannot be executed directly and only serves as a settings container.
     */
    public async execute(): Promise<void> {
        return;
    }
    // ================================================================ //

    // ========================== SETTINGS ============================ //
    /**
     * Toggles the random status feature on or off.
     *
     * @param interaction The interaction from the settings UI.
     */
    @SettingGenericSettingComponent({
        database: BotData,
        database_key: 'enable_random_status',
        format_specifier: '%s',
        is_bot_owner_only: true,
    })
    public async toggleRandomStatus(interaction: StringSelectMenuInteraction): Promise<void> {
        this.log('debug', 'settings.toggle.start', {
            name: this.name,
            guild: interaction.guild,
        });
        const settings = await this.db.findOne(BotData, { where: { id: 1 } });

        settings!.enable_random_status = !settings!.enable_random_status;
        await this.db.save(settings!);
        await this.settingsUI(interaction);
        return;
    }

    /**
     * Sets the interval (in minutes) for how often the bot's random status should change.
     *
     * @param interaction The interaction from the settings UI.
     * @param args The selected interval value from the select menu.
     */
    @SettingStringSelectComponent({
        database: BotData,
        database_key: 'random_status_interval',
        format_specifier: '%d',
        is_bot_owner_only: true,
        options: {
            values: Array.from({ length: 20 }, (p, i) => (i + 1) * 5).map((min) => ({
                label: min.toString(),
            })),
        },
    })
    public async setRandomStatusInterval(interaction: StringSelectMenuInteraction, args: string): Promise<void> {
        this.log('debug', 'settings.selectmenu.start', { name: this.name, guild: interaction.guild });
        const settings = (await this.db.findOne(BotData, {
            where: { id: 1 },
        }))!;

        settings.random_status_interval = parseFloat(args);
        await this.db.save(settings!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.selectmenu.success', { name: this.name, guild: interaction.guild });
    }

    /**
     * Manages the list of statuses the bot can randomly display.
     *
     * This opens a modal where the bot owner can provide a comma-separated list
     * of new statuses.
     *
     * @param interaction The interaction from the modal submission.
     */
    @SettingModalComponent({
        database: BotData,
        database_key: 'random_statuses',
        db_column_is_array: true,
        format_specifier: '`%s`',
        is_bot_owner_only: true,
        inputs: [
            {
                id: 'bot_random_statuses',
                style: TextInputStyle.Short,
                required: true,
                max_length: 300,
            },
        ],
    })
    public async manageRandomStatuses(interaction: ModalSubmitInteraction): Promise<void> {
        this.log('debug', 'settings.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const settings = await this.db.findOne(BotData, { where: { id: 1 } });

        const statuses = interaction.fields
            .getTextInputValue('bot_random_statuses')
            .split(',')
            .map((s) => s.trim());

        if (statuses.length === 0 || statuses.some((s) => s.length === 0)) {
            await this.settingsUI(interaction);
            return;
        }

        settings!.random_statuses = statuses;
        await this.db.save(settings!);
        await this.settingsUI(interaction);
        this.log('debug', 'settings.modalsubmit.success', {
            name: this.name,
            guild: interaction.guild,
        });
    }
    // ================================================================ //
}
