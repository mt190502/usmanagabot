import { Column, Entity } from 'typeorm';
import { Base } from './base';

@Entity()
export class Reminder extends Base {
    @Column({ type: 'varchar', length: 256, nullable: false })
    reminder_message: string;
}