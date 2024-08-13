import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Guilds {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'varchar', length: 64, nullable: false })
    name: string;

    @Column({ type: 'bigint', nullable: false, unique: true })
    gid: string;

    @Column({ type: 'simple-array', nullable: false, default: [] })
    disabled_commands: string;

    @Column({ type: 'boolean', nullable: false, default: false })
    message_logger: boolean;

    @Column({ type: 'bigint', nullable: true, default: null })
    message_logger_channel_id: string;

    @Column({ type: 'bigint', nullable: true, default: null })
    message_logger_webhook_id: string;

    @Column({ type: 'varchar', length: 128, nullable: true, default: null })
    message_logger_webhook_token: string;

    @Column({ type: 'bigint', nullable: true, default: null })
    report_channel_id: string;
}
