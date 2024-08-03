import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Channels {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'bigint', nullable: false, unique: true })
    cid: bigint;
}
