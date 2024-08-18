import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Guilds {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'varchar', length: 64, nullable: false })
    name: string;

    @Column({ type: 'bigint', nullable: false, unique: true })
    gid: BigInt;
}
