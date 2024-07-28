import { Column, Entity } from "typeorm";
import { Base } from "./base";

@Entity()
export class Introduction extends Base {
    @Column({ type: 'varchar', length: 50, nullable: false })
    nick_name: string;

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
}