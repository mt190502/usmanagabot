import 'reflect-metadata';

export function HandleAction(name: string): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        const exec: Map<string, typeof descriptor_func> =
            Reflect.getMetadata('custom:command', target_class.constructor) ?? new Map();
        exec.set(name, descriptor_func);
        Reflect.defineMetadata('custom:command', exec, target_class.constructor);
    };
}
