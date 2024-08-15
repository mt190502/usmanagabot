import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Users } from './users';
import { Guilds } from './guilds';

@Entity()
export class Verification {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'boolean', nullable: false, default: false })
    is_enabled: boolean;

    @Column({ type: 'bigint', nullable: true, default: null })
    channel_id: string;

    @Column({ type: 'bigint', nullable: true, default: null })
    role_id: string;

    @Column({ type: 'varchar', nullable: true, length: 4000, default: null })
    message: string;

    @Column({ type: 'smallint', nullable: true, default: 15 })
    minimum_days: number;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    latest_action_from_user: Users;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp: Date;

}
