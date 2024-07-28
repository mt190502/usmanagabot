import { Column, Entity } from 'typeorm';
import { Base } from './base';

@Entity()
export class Alias extends Base {
    @Column({ type: 'varchar', length: 20, nullable: false })
    name: string;

    @Column({ type: 'varchar', length: 512, nullable: false })
    content: string;
}