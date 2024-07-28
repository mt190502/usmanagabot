import { Column, Entity } from 'typeorm';
import { Base } from './base';

@Entity()
export class Afk extends Base {
    @Column({ type: 'varchar', length: 100, nullable: false })
    message: string;
}