import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Guilds } from './guilds';
import { Users } from './users';

@Entity()
export class Introduction {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id!: number;

    @Column({ type: 'boolean', nullable: false, default: false })
    is_enabled!: boolean;

    @Column({ type: 'bigint', nullable: true, default: null })
    channel_id!: string;

    @Column({ type: 'smallint', nullable: false, default: 10 })
    daily_submit_limit!: number;

    @Column({ type: 'text', array: true, nullable: true, default: '{}' })
    col1!: string[];

    @Column({ type: 'text', array: true, nullable: true, default: '{}' })
    col2!: string[];

    @Column({ type: 'text', array: true, nullable: true, default: '{}' })
    col3!: string[];

    @Column({ type: 'text', array: true, nullable: true, default: '{}' })
    col4!: string[];

    @Column({ type: 'text', array: true, nullable: true, default: '{}' })
    col5!: string[];

    @Column({ type: 'text', array: true, nullable: true, default: '{}' })
    col6!: string[];

    @Column({ type: 'text', array: true, nullable: true, default: '{}' })
    col7!: string[];

    @Column({ type: 'text', array: true, nullable: true, default: '{}' })
    col8!: string[];

    @Column({ type: 'text', nullable: true })
    yaml_data!: string;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    latest_action_from_user!: Users;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild!: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp!: Date;
}

@Entity()
export class IntroductionSubmit {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id!: number;

    @Column({ type: 'text', nullable: true })
    col1!: string;

    @Column({ type: 'text', nullable: true })
    col2!: string;

    @Column({ type: 'text', nullable: true })
    col3!: string;

    @Column({ type: 'text', nullable: true })
    col4!: string;

    @Column({ type: 'text', nullable: true })
    col5!: string;

    @Column({ type: 'text', nullable: true })
    col6!: string;

    @Column({ type: 'text', nullable: true })
    col7!: string;

    @Column({ type: 'text', nullable: true })
    col8!: string;

    @Column({ type: 'smallint', nullable: false, default: 1 })
    hourly_submit_count!: number;

    @Column({ type: 'bigint', nullable: false, default: 0 })
    last_submit_id!: bigint;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    from_user!: Users;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild!: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp!: Date;
}
