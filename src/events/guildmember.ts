import { Events, GuildMember, User } from 'discord.js';
import { BaseEvent } from '../types/structure/event';
import { RegisterFact } from '../utils/common';

/**
 * Handles the `guildMemberAdd` event.
 *
 * This event is triggered when a new user joins a guild. It ensures the user's
 * data is registered in the database.
 */
class GuildMemberAddEvent extends BaseEvent<Events.GuildMemberAdd> {
    constructor() {
        super({ enabled: true, type: Events.GuildMemberAdd, once: false });
    }

    /**
     * Executes the event logic.
     *
     * When a new member joins, this method calls `RegisterFact` to create a
     * corresponding user record in the database if one does not already exist.
     *
     * @param {GuildMember} member The member who has joined a guild.
     */
    public async execute(member: GuildMember): Promise<void> {
        await RegisterFact<User>(member.user, undefined);
    }
}

export default [GuildMemberAddEvent];
