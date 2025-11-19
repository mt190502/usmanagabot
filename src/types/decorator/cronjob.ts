import { CronJob } from 'cron';

export function Cron(options: { schedule: string; on_complete?: (...args: unknown[]) => void }): MethodDecorator {
    return (target_class, property_key, descriptor_func) => {
        new CronJob(
            options.schedule,
            (...args: unknown[]) => {
                if (typeof descriptor_func.value === 'function') descriptor_func.value.apply(target_class, args);
            },
            options.on_complete ?? null,
            true,
        );
    };
}
