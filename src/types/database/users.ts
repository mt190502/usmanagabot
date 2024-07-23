import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Users {
    @PrimaryGeneratedColumn({ type: 'smallint' })
    id: number;

    @Column({ type: 'varchar', length: 50, nullable: false, unique: true })
    userName: string;

    @Column({ type: 'bigint', nullable: false, unique: true })
    userID: number;
}
