import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Guilds } from './guilds';
import { Users } from './users';

@Entity()
export class IntroductionSubmit {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'text', nullable: true })
    col1: string;

    @Column({ type: 'text', nullable: true })
    col2: string;

    @Column({ type: 'text', nullable: true })
    col3: string;

    @Column({ type: 'text', nullable: true })
    col4: string;

    @Column({ type: 'text', nullable: true })
    col5: string;

    @Column({ type: 'text', nullable: true })
    col6: string;

    @Column({ type: 'text', nullable: true })
    col7: string;

    @Column({ type: 'text', nullable: true })
    col8: string;

    @Column({ type: 'smallint', nullable: false, default: 1 })
    hourly_submit_count: number;

    @Column({ type: 'bigint', nullable: false, default: 0 })
    last_submit_id: bigint;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    from_user: Users;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp: Date;
}
