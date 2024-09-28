import { ContextMenuCommandBuilder, SlashCommandBuilder } from 'discord.js';
import { Guilds } from '../database/guilds';

export interface Command_t {
    enabled: boolean;
    name: string;
    type: 'customizable' | 'standard';
    description: string;

    category: 'admin' | 'core' | 'game' | 'misc' | 'tools' | 'pseudo' | 'utils';
    usewithevent: string[];
    cooldown: number;
    usage: string;

    data: Array<
        (
            guild?: Guilds
        ) =>
            | ContextMenuCommandBuilder
            | Promise<ContextMenuCommandBuilder>
            | Promise<SlashCommandBuilder>
            | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
            | Promise<Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>>
    >;
    execute: (interaction: unknown, ...args: unknown[]) => Promise<void>;
    execute_when_event: (event_name: string, data: unknown, ...args: unknown[]) => Promise<void>;
    settings: (interaction: unknown) => Promise<void>;
}
