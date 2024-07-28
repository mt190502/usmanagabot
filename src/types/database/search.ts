import { Column, Entity } from 'typeorm';
import { Base } from './base';

@Entity()
export class Search extends Base {
    @Column({ type: 'varchar', length: 32 })
    engine_name: string;

    @Column({ type: 'varchar', length: 255 })
    engine_url: string;
}
