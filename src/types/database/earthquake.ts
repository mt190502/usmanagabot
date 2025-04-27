import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Guilds } from './guilds';
import { Users } from './users';

@Entity()
export class Earthquake {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'boolean', nullable: false, default: false })
    is_enabled: boolean;

    @Column({ type: 'bigint', nullable: true, default: null })
    channel_id: string;

    @Column({ type: 'float', nullable: true, default: null })
    magnitude_limit: number;

    @Column({ type: 'text', nullable: true, default: null })
    seismic_portal_api_url: string;

    @Column({ type: 'smallint', nullable: false, default: 5 })
    check_interval: number;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    latest_action_from_user: Users;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp: Date;
}
