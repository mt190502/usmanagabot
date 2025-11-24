import {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
} from 'discord.js';
import { EntityTarget, ObjectLiteral } from 'typeorm';
import { Database } from '../../services/database';
import { Translator } from '../../services/translator';
import { BaseCommand, CustomizableCommand } from '../structure/command';

/** ***************************************************************************
 * Base options for setting components
 * ****************************************************************************/

/**
 * Options for setting components
 * @property {string} [display_name] - The display name of the setting
 * @property {string} pretty - A human-readable name for the setting
 * @property {string} description - A description of the setting
 * @property {string} [format_specifier] - A format specifier for displaying the setting value
 * @property {ObjectLiteral} [database] - The database entity associated with the setting
 * @property {string} [database_key] - The key in the database entity for the setting
 * @property {boolean} [db_column_is_array=false] - Whether the database column is an array
 */
type componentOptions = {
    display_name: string;
    pretty: string;
    description: string;
    format_specifier: string;
    database: EntityTarget<ObjectLiteral>;
    database_key: string;
    db_column_is_array?: boolean;
    is_bot_owner_only: boolean;
    view_in_ui: boolean;
};

/**
 * Descriptor type for setting component methods
 * @param {BaseCommand | CustomizableCommand} this - The command instance
 * @param {ModalSubmitInteraction | StringSelectMenuInteraction} interaction - The interaction object
 * @param {...unknown[]} args - Additional arguments
 * @returns {Promise<void>} A promise that resolves when the method is complete
 */
type descriptorType = (
    this: BaseCommand | CustomizableCommand,
    interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
    ...args: unknown[]
) => Promise<void>;

/**
 * Generates a setting component decorator
 * @param {componentOptions} o - The options for the setting component
 * @param {function} [wrapper] - An optional wrapper function for the original method
 * @returns {MethodDecorator} A method decorator for the setting component
 */
function generateSettingComponent(
    o: Partial<componentOptions>,
    wrapper?: (
        orig: descriptorType,
        context: {
            name: string;
            pretty_key: string;
            options: object;
        },
    ) => descriptorType,
): MethodDecorator {
    return (target, key, descriptor: PropertyDescriptor) => {
        const name = new (target.constructor as new () => BaseCommand)().name;
        const pretty_key = key.toString().toLowerCase();
        const metadata: Map<string, Omit<typeof o, 'options'> & { func: typeof descriptor }> =
            Reflect.getMetadata('custom:settings', target.constructor) ?? new Map();

        if (wrapper) {
            const orig = descriptor.value;
            descriptor.value = wrapper(orig, { name, pretty_key, options: o });
        }

        metadata.set(pretty_key, {
            pretty: t(o.pretty ?? `${name}.settings.${pretty_key}.pretty_name`),
            database: o.database,
            database_key: o.database_key,
            display_name:
                pretty_key == 'toggle'
                    ? t('command.settings.toggle.display_name')
                    : t(o.display_name ?? `${name}.settings.${pretty_key}.display_name`),
            description: t(o.description ?? `${name}.settings.${pretty_key}.description`),
            format_specifier: o.format_specifier ?? t('command.settings.view_in_edit_mode'),
            db_column_is_array: o.db_column_is_array ?? false,
            is_bot_owner_only: o.is_bot_owner_only ?? false,
            view_in_ui: o.view_in_ui ?? true,
            func: descriptor,
        });

        Reflect.defineMetadata('custom:settings', metadata, target.constructor);
    };
}

/**
 * Translate a command string using the commands localization category.
 * This method provides localization support for user-facing messages in commands.
 *
 * @protected
 * @param {string} key Localization key from the commands category (e.g., 'purge.warning.title')
 * @param {Record<string, unknown>} [replacements] Optional placeholder replacements for dynamic values
 * @returns {string} Translated message in the current language
 */
function t(key: string, replacements?: Record<string, unknown>): string {
    const translator = Translator.getInstance();
    return translator.querySync('commands', key, replacements);
}
/** ************************************************************************** */

/**
 * Generic setting decorator to generate a basic setting component
 * @param {object} o - The options for the generic setting
 * @returns {MethodDecorator} A method decorator for the generic setting
 */
export function SettingGenericSettingComponent(o: Partial<componentOptions>): MethodDecorator {
    return generateSettingComponent(o);
}

/**
 * String select menu setting decorator to generate a string select menu component
 * @param {object} o - The options for the string select menu setting
 * @param {number} [o.options.min_values=1] - The minimum number of selections allowed
 * @param {number} [o.options.max_values=1] - The maximum number of selections allowed
 * @param {Array} o.options.values - An array of option configurations for the select menu
 * @returns {MethodDecorator} A method decorator for the string select menu setting
 */
export function SettingStringSelectComponent(
    o: Partial<componentOptions> & {
        options?: {
            min_values?: number;
            max_values?: number;
            values: { label: string; description?: string }[];
        };
    },
): MethodDecorator {
    return generateSettingComponent(o, (orig, { name, pretty_key, options }) => {
        return async function(this, interaction, ...args: unknown[]) {
            if (interaction.isStringSelectMenu() && args.length > 0) {
                return await orig.apply(this, [interaction, ...args]);
            } else if (interaction.isStringSelectMenu()) {
                await interaction.update({
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(`settings:${name}:${pretty_key}`)
                                .setPlaceholder(t(`${name}.settings.${pretty_key}.placeholder`))
                                .setMinValues((options as typeof o).options?.min_values ?? 1)
                                .setMaxValues((options as typeof o).options?.max_values ?? 1)
                                .addOptions(
                                    (options as typeof o).options?.values.map((val) => ({
                                        label: val.label,
                                        description: val.description,
                                        value: `settings:${name}:${pretty_key}:${val.label}`,
                                    })) ?? [],
                                ),
                        ),
                    ],
                });
            };
        };
    });
}

/**
 * Channel select menu setting decorator to generate a channel select menu component
 * @param {object} o - The options for the channel select menu setting
 * @param {ChannelType[]} [o.options.channel_types] - The types of channels to include in the select menu
 * @param {number} [o.options.min_values=1] - The minimum number of selections allowed
 * @param {number} [o.options.max_values=1] - The maximum number of selections allowed
 * @param {string} [o.options.placeholder='Select a channel'] - The placeholder text for the select menu
 * @returns {MethodDecorator} A method decorator for the channel select menu setting
 */
export function SettingChannelMenuComponent(
    o: Partial<componentOptions> & {
        options?: {
            channel_types?: ChannelType[];
            min_values?: number;
            max_values?: number;
            placeholder?: string;
        };
    },
): MethodDecorator {
    return generateSettingComponent(o, (orig, { name, pretty_key, options }) => {
        return async function(this, interaction, ...args: unknown[]) {
            if (interaction.isChannelSelectMenu()) {
                return await orig.apply(this, [interaction, ...args]);
            }

            if (!interaction.isStringSelectMenu()) return;
            await interaction.update({
                components: [
                    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                        new ChannelSelectMenuBuilder()
                            .setCustomId(`settings:${name}:${pretty_key}`)
                            .setPlaceholder(
                                t(
                                    (options as typeof o).options?.placeholder ??
                                        `${name}.settings.${pretty_key}.placeholder`,
                                ),
                            )
                            .setMinValues((options as typeof o).options?.min_values ?? 1)
                            .setMaxValues((options as typeof o).options?.max_values ?? 1)
                            .addChannelTypes((options as typeof o).options?.channel_types ?? []),
                    ),
                ],
            });
        };
    });
}

/**
 * Role select menu setting decorator to generate a role select menu component
 * @param {object} o - The options for the role select menu setting
 * @param {number} [o.options.min_values=1] - The minimum number of selections allowed
 * @param {number} [o.options.max_values=1] - The maximum number of selections allowed
 * @param {string} [o.options.placeholder='Select a role'] - The placeholder text for the select menu
 * @returns {MethodDecorator} A method decorator for the role select menu setting
 */
export function SettingRoleSelectMenuComponent(
    o: Partial<componentOptions> & {
        options?: {
            min_values?: number;
            max_values?: number;
            placeholder?: string;
        };
    },
): MethodDecorator {
    return generateSettingComponent(o, (orig, { name, pretty_key, options }) => {
        return async function(this, interaction, ...args: unknown[]) {
            if (interaction.isRoleSelectMenu()) {
                return await orig.apply(this, [interaction, ...args]);
            }

            if (!interaction.isStringSelectMenu()) return;
            await interaction.update({
                components: [
                    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                        new RoleSelectMenuBuilder()
                            .setCustomId(`settings:${name}:${pretty_key}`)
                            .setPlaceholder(
                                t(
                                    (options as typeof o).options?.placeholder ??
                                        `${name}.settings.${pretty_key}.placeholder`,
                                ),
                            )
                            .setMinValues((options as typeof o).options?.min_values ?? 1)
                            .setMaxValues((options as typeof o).options?.max_values ?? 1),
                    ),
                ],
            });
        };
    });
}

/**
 * User select menu setting decorator to generate a user select menu component
 * @param {object} o - The options for the user select menu setting
 * @param {number} [o.options.min_values=1] - The minimum number of selections allowed
 * @param {number} [o.options.max_values=1] - The maximum number of selections allowed
 * @param {string} [o.options.placeholder='Select a user'] - The placeholder text for the select menu
 * @returns {MethodDecorator} A method decorator for the user select menu setting
 */
export function SettingUserSelectMenuComponent(
    o: Partial<componentOptions> & {
        options?: {
            min_values?: number;
            max_values?: number;
            placeholder?: string;
        };
    },
): MethodDecorator {
    return generateSettingComponent(o, (orig, { name, pretty_key, options }) => {
        return async function(this, interaction, ...args: unknown[]) {
            if (interaction.isUserSelectMenu()) {
                return await orig.apply(this, [interaction, ...args]);
            }

            if (!interaction.isStringSelectMenu()) return;
            await interaction.update({
                components: [
                    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
                        new UserSelectMenuBuilder()
                            .setCustomId(`settings:${name}:${pretty_key}`)
                            .setPlaceholder(
                                t(
                                    (options as typeof o).options?.placeholder ??
                                        `${name}.settings.${pretty_key}.placeholder`,
                                ),
                            )
                            .setMinValues((options as typeof o).options?.min_values ?? 1)
                            .setMaxValues((options as typeof o).options?.max_values ?? 1),
                    ),
                ],
            });
        };
    });
}

/**
 * Modal setting decorator to generate a modal input component
 * @param {object} o - The options for the modal setting
 * @param {Array} o.inputs - An array of input configurations for the modal
 * @param {boolean} [o.require_selectmenu] - Whether to show a StringSelectMenu before the modal
 * @param {object} [o.select_menu] - Configuration for the select menu (if required)
 * @param {boolean} [o.select_menu.enable=false] - Whether to enable the select menu
 * @param {string} o.select_menu.label_key - The database key to use for option labels
 * @param {string} o.select_menu.description_key - The database key to use for option descriptions
 * @param {boolean} [o.select_menu.include_cancel=true] - Whether to include a cancel option
 * @param {string} [o.modal_title] - Optional modal title override (defaults to display_name)
 * @returns {MethodDecorator} A method decorator for the modal setting
 */
export function SettingModalComponent(
    o: Partial<componentOptions> & {
        require_selectmenu?: boolean;
        select_menu?: {
            enable: boolean;
            label_key: string;
            description_key: string;
            include_cancel?: boolean;
        };
        inputs: ({
            id: string;
            style?: TextInputStyle;
            required?: boolean;
            placeholder?: string;
            min_length?: number;
            max_length?: number;
        } & Partial<Pick<componentOptions, 'database' | 'database_key' | 'db_column_is_array'>>)[];
    },
): MethodDecorator {
    return generateSettingComponent(o, (orig, { name, pretty_key, options }) => {
        return async function(this, interaction, ...args: unknown[]) {
            if (interaction.isModalSubmit()) {
                if ((options as typeof o).require_selectmenu) {
                    const custom_id_parts = interaction.customId.split(':');
                    const selected_value = custom_id_parts[custom_id_parts.length - 1];
                    return await orig.apply(this, [interaction, selected_value, ...args]);
                }
                return await orig.apply(this, [interaction, ...args]);
            }
            const inputs = (options as typeof o).inputs || [];
            if (inputs.length < 1 || inputs.length > 5) {
                throw new Error(`SettingModalComponent: inputs array must contain 1-5 items, got ${inputs.length}`);
            }

            const enable_select_menu = (options as typeof o).select_menu?.enable;
            const config = (options as typeof o).select_menu;

            const fetchItems = () =>
                Database.dbManager.find(o.database!, {
                    where: o.is_bot_owner_only ? { id: 1 } : { from_guild: { gid: BigInt(interaction.guildId!) } },
                });

            const buildTextInput = (input: typeof o.inputs[number], value?: string) => {
                const ti = new TextInputBuilder()
                    .setCustomId(input.id)
                    .setLabel(t(`${name}.settings.${pretty_key}.parameters.${input.id}`))
                    .setPlaceholder(t(`${name}.settings.${pretty_key}.parameters.${input.id}`))
                    .setStyle(input.style ?? TextInputStyle.Short)
                    .setRequired(input.required ?? true);

                if (value !== undefined) ti.setValue(String(value));
                if (input.min_length !== undefined) ti.setMinLength(input.min_length);
                if (input.max_length !== undefined) ti.setMaxLength(input.max_length);

                return new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(ti);
            };

            if (enable_select_menu) {
                if (interaction.isStringSelectMenu() && interaction.customId === `settings:${name}`) {
                    const items = await fetchItems();

                    const select_options = items.map((item) => ({
                        label: String(item[config!.label_key]),
                        description: config!.description_key ? String(item[config!.description_key]) : undefined,
                        value: `settings:${name}:${pretty_key}:${String(item[config!.label_key])}`,
                    }));

                    if (config!.include_cancel !== false) {
                        select_options.push({
                            label: t('command.settings.cancel.display_name'),
                            description: t('command.settings.cancel.description'),
                            value: `settings:${name}`,
                        });
                    }

                    await interaction.update({
                        components: [
                            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(`settings:${name}:${pretty_key}`)
                                    .setPlaceholder(t(`${name}.settings.${pretty_key}.placeholder`))
                                    .addOptions(select_options),
                            ),
                        ],
                    });
                    return;
                }

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId.startsWith(`settings:${name}:${pretty_key}`)
                ) {
                    const selected_value = interaction.values[0].split(':').pop()!;
                    const items = await fetchItems();
                    const selected_item = items.find((x) => String(x[config!.label_key]) === selected_value);

                    const components = inputs.map((input) =>
                        buildTextInput(input, input.database_key ? selected_item?.[input.database_key] : undefined),
                    );

                    await interaction.showModal(
                        new ModalBuilder()
                            .setCustomId(`settings:${name}:${pretty_key}:${selected_value}`)
                            .setTitle(t(`${name}.settings.${pretty_key}.title`, { name: selected_value }))
                            .addComponents(components),
                    );
                    return;
                }
            }

            const components = [];
            for (const input of inputs) {
                let value;

                if (o.database || input.database) {
                    const db = input.database ?? o.database!;
                    const key = input.database_key ?? o.database_key!;

                    if (o.db_column_is_array || input.db_column_is_array) {
                        const items = await Database.dbManager.find(db, {
                            where: o.is_bot_owner_only ? { id: 1 } : { from_guild: { gid: interaction.guild?.id } },
                        });

                        value = items.map((e) => e[key]).join(', ');
                    } else {
                        const item = await Database.dbManager.findOne(db, {
                            where: o.is_bot_owner_only ? { id: 1 } : { from_guild: { gid: interaction.guild?.id } },
                        });

                        value = item?.[key] ?? input.placeholder ?? '';
                    }
                }

                components.push(buildTextInput(input, value));
            }

            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId(`settings:${name}:${pretty_key}`)
                    .setTitle(t(`${name}.settings.${pretty_key}.pretty_name`))
                    .addComponents(components),
            );
        };
    });
}
