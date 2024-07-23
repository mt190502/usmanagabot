import { Collection, Events, Interaction, InteractionResponse } from 'discord.js';
import { Events_t } from '../../types/interface/events';

const interactionCooldown: Collection<string, Collection<number, number>> = new Collection();

const exec = async (interaction: Interaction): Promise<void | InteractionResponse<boolean>> => {
        console.log(interaction);
}

export default {
    enabled: true,
    once: false,
    name: 'interactionCreate',
    data: Events.InteractionCreate,
    execute: exec,
} as Events_t;
