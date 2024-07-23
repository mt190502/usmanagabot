import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Guilds {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'varchar', length: 50, nullable: false })
    guildName: string;

    @Column({ type: 'bigint', nullable: false, unique: true })
    guildID: number;
}
