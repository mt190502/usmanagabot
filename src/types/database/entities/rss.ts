import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Channels } from './channels';
import { Guilds } from './guilds';
import { Users } from './users';

@Entity()
export class RSS {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id!: number;

    @Column({ type: 'varchar', length: 64, nullable: false })
    feed_name!: string;

    @Column({ type: 'varchar', nullable: false })
    feed_url!: string;

    @Column({ type: 'simple-array', default: [] })
    last_feed_items!: string;

    @ManyToOne(() => Channels, { nullable: false, eager: true })
    @JoinColumn({ name: 'feed_channel_id', referencedColumnName: 'id' })
    feed_channel_id!: string;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    from_user!: Users;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild!: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp!: Date;
}
