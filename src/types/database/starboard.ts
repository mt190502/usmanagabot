import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Base } from './base';
import { Messages } from './messages';

@Entity()
export class Starboard extends Base {
    @Column({ type: 'smallint', nullable: false })
    star_count: number;

    @ManyToOne(() => Messages, { nullable: false, eager: true })
    @JoinColumn({ name: 'message_id', referencedColumnName: 'id' })
    message_id: Messages;
}
