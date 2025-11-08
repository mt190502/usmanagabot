import 'reflect-metadata';

export function CommandSetting(o: { name: string; description: string }): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        const settings: Map<string, { desc: string; func: typeof descriptor_func }> =
            Reflect.getMetadata('custom:settings', target_class.constructor) ?? new Map();
        settings.set(o.name, { desc: o.description, func: descriptor_func });
        Reflect.defineMetadata('custom:settings', settings, target_class.constructor);
    };
}

export function CommandAction(name: string): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        const exec: Map<string, typeof descriptor_func> =
            Reflect.getMetadata('custom:command', target_class.constructor) ?? new Map();
        exec.set(name, descriptor_func);
        Reflect.defineMetadata('custom:command', exec, target_class.constructor);
    };
}
