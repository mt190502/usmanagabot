import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class BotData {
    @PrimaryColumn({ type: 'varchar', default: '0' })
    key: string;

    @Column({ type: 'varchar', default: '0' })
    value: any;
}
