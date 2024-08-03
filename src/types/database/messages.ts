import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Channels } from './channels';
import { Guilds } from './guilds';
import { Users } from './users';

@Entity()
export class Messages {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'varchar', nullable: false, length: 4000 })
    message: string;

    @Column({ type: 'boolean', nullable: false, default: false })
    message_is_deleted: boolean;

    @Column({ type: 'boolean', nullable: false, default: false })
    message_is_edited: boolean;

    @Column({ type: 'varchar', nullable: true, default: null, length: 4000 })
    old_message?: string;

    @Column({ type: 'simple-array', nullable: true, default: null })
    attachments?: string[];

    @Column({ type: 'boolean', nullable: false, default: false })
    attachments_is_deleted: boolean;

    @Column({ type: 'boolean', nullable: false, default: false })
    attachments_is_edited: boolean;

    @Column({ type: 'simple-array', nullable: true, default: null })
    old_attachments?: string[];

    @Column({ type: 'bigint', nullable: false })
    message_id: bigint;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    from_user: Users;

    @ManyToOne(() => Channels, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_channel', referencedColumnName: 'id' })
    from_channel: Channels;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp: Date;
}