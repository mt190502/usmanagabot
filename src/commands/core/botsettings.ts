import { ModalSubmitInteraction, StringSelectMenuInteraction, TextInputStyle } from 'discord.js';
import { BotData } from '../../types/database/entities/bot';
import {
    SettingGenericSettingComponent,
    SettingModalComponent,
    SettingStringSelectComponent,
} from '../../types/decorator/settingcomponents';
import { CustomizableCommand } from '../../types/structure/command';

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
        this.log.send('debug', 'command.setting.selectmenu.start', { name: this.name, guild: interaction.guild });
        const settings = (await this.db.findOne(BotData, {
            where: { id: 1 },
        }))!;

        settings.random_status_interval = parseFloat(args);
        await this.db.save(settings!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.selectmenu.success', { name: this.name, guild: interaction.guild });
    }

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
        this.log.send('debug', 'command.setting.modalsubmit.start', { name: this.name, guild: interaction.guild });
        const settings = await this.db.findOne(BotData, { where: { id: 1 } });

        const statuses = interaction.fields.getTextInputValue('bot_random_statuses');
        settings!.random_statuses = statuses.split(',').map((s) => s.trim());
        await this.db.save(settings!);
        await this.settingsUI(interaction);
        this.log.send('debug', 'command.setting.modalsubmit.success', {
            name: this.name,
            guild: interaction.guild,
        });
    }
    // ================================================================ //
}
