import { Events, GuildMember, User } from 'discord.js';
import { BaseEvent } from '../types/structure/event';
import { RegisterFact } from '../utils/common';

class GuildMemberAddEvent extends BaseEvent<Events.GuildMemberAdd> {
    constructor() {
        super({ enabled: true, type: Events.GuildMemberAdd, once: false });
    }

    public async execute(member: GuildMember): Promise<void> {
        await RegisterFact<User>(member.user, undefined);
    }
}

export default [GuildMemberAddEvent];
