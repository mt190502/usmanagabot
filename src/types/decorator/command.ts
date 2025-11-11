import 'reflect-metadata';
import { ObjectLiteral } from 'typeorm';

export function HandleAction(name: string): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        const exec: Map<string, typeof descriptor_func> =
            Reflect.getMetadata('custom:command', target_class.constructor) ?? new Map();
        exec.set(name, descriptor_func);
        Reflect.defineMetadata('custom:command', exec, target_class.constructor);
    };
}

export function CommandSetting(options: {
    display_name?: string;
    database?: ObjectLiteral;
    database_key?: string;
    pretty: string;
    description: string;
    format_specifier?: string;
    db_column_is_array?: boolean;
}): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        const settings: Map<string, typeof options & { func: typeof descriptor_func }> =
            Reflect.getMetadata('custom:settings', target_class.constructor) ?? new Map();
        settings.set(property_key.toString().toLowerCase() as string, {
            pretty: options.pretty,
            database: options.database,
            database_key: options.database_key,
            display_name: options.display_name,
            description: options.description,
            format_specifier: options.format_specifier ?? '`View in Edit Mode`',
            db_column_is_array: options.db_column_is_array ?? false,
            func: descriptor_func,
        });
        Reflect.defineMetadata('custom:settings', settings, target_class.constructor);
    };
}
