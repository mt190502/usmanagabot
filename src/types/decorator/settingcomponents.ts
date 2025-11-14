import {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    RoleSelectMenuBuilder,
    StringSelectMenuInteraction,
    UserSelectMenuBuilder,
} from 'discord.js';
import { ObjectLiteral } from 'typeorm';
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
    display_name?: string;
    pretty: string;
    description: string;
    format_specifier?: string;
    database?: ObjectLiteral;
    database_key?: string;
    db_column_is_array?: boolean;
};

/**
 * Descriptor type for setting component methods
 * @param {BaseCommand | CustomizableCommand} this - The command instance
 * @param {StringSelectMenuInteraction} interaction - The interaction object
 * @param {...unknown[]} args - Additional arguments
 * @returns {Promise<void>} A promise that resolves when the method is complete
 */
type descriptorType = (
    this: BaseCommand | CustomizableCommand,
    interaction: StringSelectMenuInteraction,
    ...args: unknown[]
) => Promise<void>;

/**
 * Generates a setting component decorator
 * @param {componentOptions} o - The options for the setting component
 * @param {function} [wrapper] - An optional wrapper function for the original method
 * @returns {MethodDecorator} A method decorator for the setting component
 */
function generateSettingComponent(
    o: componentOptions,
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
            pretty: o.pretty,
            database: o.database,
            database_key: o.database_key,
            display_name: o.display_name,
            description: o.description,
            format_specifier: o.format_specifier ?? '`View in Edit Mode`',
            db_column_is_array: o.db_column_is_array ?? false,
            func: descriptor,
        });

        Reflect.defineMetadata('custom:settings', metadata, target.constructor);
    };
}
/** ************************************************************************** */

/**
 * Generic setting decorator
 * @param {object} o - The options for the setting
 * @param {string} [o.display_name] - The display name of the setting
 * @param {string} o.pretty - A human-readable name for the setting
 * @param {string} o.description - A description of the setting
 * @param {string} [o.format_specifier] - A format specifier for displaying the setting value
 * @param {ObjectLiteral} [o.database] - The database entity associated with the setting
 * @param {string} [o.database_key] - The key in the database entity for the setting
 * @param {boolean} [o.db_column_is_array=false] - Whether the database column is an array
 * @returns {MethodDecorator} A method decorator for the generic setting
 */
export function GenericSetting(o: {
    display_name?: string;
    pretty: string;
    description: string;
    format_specifier?: string;
    database?: ObjectLiteral;
    database_key?: string;
    db_column_is_array?: boolean;
}): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        const settings: Map<string, typeof o & { func: typeof descriptor_func }> =
            Reflect.getMetadata('custom:settings', target_class.constructor) ?? new Map();
        settings.set(property_key.toString().toLowerCase() as string, {
            pretty: o.pretty,
            database: o.database,
            database_key: o.database_key,
            display_name: o.display_name,
            description: o.description,
            format_specifier: o.format_specifier ?? '`View in Edit Mode`',
            db_column_is_array: o.db_column_is_array ?? false,
            func: descriptor_func,
        });
        Reflect.defineMetadata('custom:settings', settings, target_class.constructor);
    };
}

/**
 * Toggle button setting decorator to generate a toggle button component
 * @param {componentOptions} o - The options for the toggle button setting
 * @returns {MethodDecorator} A method decorator for the toggle button setting
 */
export function SettingToggleButtonComponent(o: componentOptions): MethodDecorator {
    return generateSettingComponent(o);
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
    o: componentOptions & {
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

            await interaction.update({
                components: [
                    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                        new ChannelSelectMenuBuilder()
                            .setCustomId(`settings:${name}:${pretty_key}`)
                            .setPlaceholder((options as typeof o).options?.placeholder ?? 'Select a channel')
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
    o: componentOptions & {
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

            await interaction.update({
                components: [
                    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                        new RoleSelectMenuBuilder()
                            .setCustomId(`settings:${name}:${pretty_key}`)
                            .setPlaceholder((options as typeof o).options?.placeholder ?? 'Select a role')
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
    o: componentOptions & {
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

            await interaction.update({
                components: [
                    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
                        new UserSelectMenuBuilder()
                            .setCustomId(`settings:${name}:${pretty_key}`)
                            .setPlaceholder((options as typeof o).options?.placeholder ?? 'Select a user')
                            .setMinValues((options as typeof o).options?.min_values ?? 1)
                            .setMaxValues((options as typeof o).options?.max_values ?? 1),
                    ),
                ],
            });
        };
    });
}
