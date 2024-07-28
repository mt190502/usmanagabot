import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Base } from './base';
import { Users } from './users';

@Entity()
export class Warn extends Base {
    @Column({ type: 'varchar', length: 512, nullable: false })
    reason: string;

    @Column({ type: 'uuid', nullable: false })
    process_id: string;

    @Column({ type: 'smallint', nullable: false })
    warn_level: number;

    @Column({ type: 'bigint', nullable: false })
    moderator_id: string;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'target_user', referencedColumnName: 'id' })
    target_user: number;
}
