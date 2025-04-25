import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Guilds } from './guilds';

@Entity()
export class EarthquakeLogs {
    @PrimaryColumn({ type: 'varchar', length: 64, nullable: false })
    source_id: string;

    @Column({ type: 'varchar', length: 32, nullable: false })
    source_name: string;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp: Date;
}
