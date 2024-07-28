import { Column, Entity } from 'typeorm';
import { Base } from './base';

@Entity()
export class RSS extends Base {
    @Column({ type: 'varchar', length: 64, nullable: false })
    feed_name: string;

    @Column({ type: 'varchar', nullable: false })
    feed_url: string;

    @Column({ type: 'bigint', nullable: false })
    feed_channel_id: string;

    @Column({ type: 'simple-array', default: [] })
    last_feed_items: string[];
}