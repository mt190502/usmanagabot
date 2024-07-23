import { Column, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Guilds } from './guilds';
import { Users } from './users';

export class Base {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'date' })
    date: string;

    @Column({ type: 'time' })
    time: string;

    @ManyToOne(() => Users, { nullable: false })
    @JoinColumn({ name: 'fromUser' })
    fromUser: number;

    @ManyToOne(() => Guilds, { nullable: false })
    @JoinColumn({ name: 'fromGuild' })
    fromGuild: number;
}
