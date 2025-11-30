import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BotData {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id!: number;

    @Column({ type: 'boolean', default: false })
    enable_random_status!: boolean;

    @Column({ type: 'smallint', default: 10 })
    random_status_interval!: number;

    @Column({ type: 'text', array: true, default: '{}' })
    random_statuses!: string[];
}
