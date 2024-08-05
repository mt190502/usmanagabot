import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Guilds } from "./guilds";
import { Users } from "./users";

@Entity()
export class Introduction {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;
    
    @Column({ type: 'varchar', length: 50 })
    col01: string;

    @Column({ type: 'varchar', length: 50 })
    col02: string;

    @Column({ type: 'varchar', length: 50 })
    col03: string;

    @Column({ type: 'varchar', length: 50 })
    col04: string;

    @Column({ type: 'varchar', length: 50 })
    col05: string;

    @Column({ type: 'varchar', length: 50 })
    col06: string;

    @Column({ type: 'varchar', length: 50 })
    col07: string;

    @Column({ type: 'varchar', length: 50 })
    col08: string;

    @ManyToOne(() => Users, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_user', referencedColumnName: 'id' })
    from_user: Users;

    @ManyToOne(() => Guilds, { nullable: false, eager: true })
    @JoinColumn({ name: 'from_guild', referencedColumnName: 'id' })
    from_guild: Guilds;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    timestamp: Date;
}