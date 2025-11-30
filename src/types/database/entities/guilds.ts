import { Locale } from 'discord.js';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Guilds {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id!: number;

    @Column({ type: 'varchar', length: 64, nullable: false })
    name!: string;

    @Column({ type: 'bigint', nullable: false, unique: true })
    gid!: bigint;

    @Column({ type: 'varchar', length: 8, nullable: false })
    country!: Locale;
}
