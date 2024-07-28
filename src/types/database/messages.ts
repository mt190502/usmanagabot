import { Column, Entity } from 'typeorm';
import { Base } from './base';

@Entity()
export class Messages extends Base {
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
    message_id: number;
}