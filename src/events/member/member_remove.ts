import { Events, GuildMember } from 'discord.js';
import { BotCommands } from '../../main';
import { Event_t } from '../../types/interface/events';
import { CheckAndAddUser } from '../../utils/common';
import { Logger } from '../../utils/logger';

const exec = async (member: GuildMember) => {
    Logger('info', `Member left: "${member.user.tag} (${member.id})"`);
    await CheckAndAddUser(member.user, null);

    for (const [, cmd_data] of BotCommands.get(BigInt(member.guild?.id)).concat(BotCommands.get(BigInt(0)))) {
        if (cmd_data.usewithevent?.includes('guildMemberRemove')) {
            cmd_data.execute_when_event('guildMemberRemove', member);
        }
    }
};

export default {
    enabled: true,
    once: false,
    name: 'guildMemberRemove',
    data: Events.GuildMemberRemove,
    execute: exec,
} as Event_t;
