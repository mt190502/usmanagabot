import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Guilds } from './guilds';
import { Users } from './users';

@Entity()
export class MessageLogger {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id!: number;

    @Column({ type: 'boolean', nullable: false, default: false })
    is_enabled!: boolean;

    @Column({ type: 'bigint', nullable: true, default: null })
    channel_id!: string;

    @Column({ type: 'bigint', nullable: true, default: null })
    webhook_id!: string;

    @Column({ type: 'varchar', length: 128, nullable: true, default: null })
    webhook_token!: string;

    @Column({ type: 'simple-array', nullable: true, default: null })
    ignored_channels!: bigint[];

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    latest_action_from_user!: Users;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild!: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp!: Date;
}
