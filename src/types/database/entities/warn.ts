import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Channels } from './channels';
import { Guilds } from './guilds';
import { Users } from './users';

@Entity()
export class Warn {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id!: number;

    @Column({ type: 'varchar', length: 512, nullable: false })
    reason!: string;

    @Column({ type: 'uuid', nullable: false })
    process_id!: string;

    @Column({ type: 'smallint', nullable: false })
    warn_level!: number;

    @Column({ type: 'bigint', nullable: false })
    moderator_id!: string;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'target_user', referencedColumnName: 'id' })
    target_user!: Users;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    from_user!: Users;

    @ManyToOne(() => Channels, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_channel', referencedColumnName: 'id' })
    from_channel!: Channels;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild!: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp!: Date;
}
