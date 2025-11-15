import {
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    Events,
    Message,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import { Afk } from '../../types/database/entities/afk';
import { ChainEvent } from '../../types/decorator/chainevent';
import { BaseCommand } from '../../types/structure/command';

export default class AFKCommand extends BaseCommand {
    constructor() {
        super({
            name: 'afk',
            pretty_name: 'AFK',
            description: 'Set your AFK (Away From Keyboard) status.',
            cooldown: 10,
            help: `
                Set your AFK (Away From Keyboard) status.

                **Usage:**
                - \`/afk [reason]\` - Sets your AFK status with an reason.

                **Examples:**
                - \`/afk reason:I'm currently away.\`
            `,
        });
        (this.base_cmd_data as SlashCommandBuilder).addStringOption((option) =>
            option.setName('reason').setDescription('The reason for going AFK.').setRequired(true),
        );
    }

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const member = interaction.guild!.members.cache.get(interaction.user.id)!;
        const user = (await this.db.getUser(BigInt(interaction.user.id)))!;
        const guild = (await this.db.getGuild(BigInt(interaction.guild!.id)))!;
        const user_afk = await this.db.findOne(Afk, { where: { from_user: user, from_guild: guild } });
        const reason = interaction.options.getString('reason')!;
        const post = new EmbedBuilder();

        if (user_afk) {
            post.setTitle(':warning: You are already AFK!').setColor(Colors.Yellow);
            await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
            return;
        }

        const afk = new Afk();
        afk.from_user = user;
        afk.from_guild = guild;
        afk.message = reason;
        await this.db.save(afk);

        post.setTitle(':white_check_mark: You are now AFK').setColor(Colors.Green);
        if (!member.manageable) {
            post.setDescription('**Warning:** I am unable to change your nickname (Probably due to role hierarchy)');
        } else {
            await member.setNickname(
                member.nickname ? '[AFK] ' + member.nickname : '[AFK] ' + interaction.user.displayName,
            );
        }

        await interaction.reply({ embeds: [post], flags: MessageFlags.Ephemeral });
    }

    @ChainEvent({ type: Events.MessageCreate })
    public async onMessageCreate(message: Message<true>): Promise<void> {
        if (message?.author?.bot || !message.guild) return;

        const member = message.guild.members.cache.get(message.author.id)!;
        const user = (await this.db.getUser(BigInt(message.author.id)))!;
        const guild = (await this.db.getGuild(BigInt(message.guild.id)))!;
        const user_afk = await this.db.findOne(Afk, { where: { from_user: user, from_guild: guild } });

        if (user_afk) {
            const post = new EmbedBuilder();
            if (member.manageable) await member?.setNickname(member.nickname!.replaceAll('[AFK]', ''));
            post.setTitle(':white_check_mark: You are no longer AFK').setColor(Colors.Green);
            if (user_afk.mentions.length > 0) {
                post.setDescription(
                    `You were mentioned **${user_afk.mentions.length}** times while you were **AFK** and I have sent you a DM with the message urls`,
                );
                await message.author.send({
                    content: 'You were mentioned while you were **AFK**\n' + user_afk.mentions.join('\n'),
                });
            }
            await this.db.delete(Afk, { id: user_afk.id });
            await message.reply({ embeds: [post] });
        }
        for (const mention of message.mentions.users) {
            const mentioned_user_afk = await this.db.findOne(Afk, {
                where: { from_user: { uid: BigInt(mention[0]) }, from_guild: guild },
            });
            if (mentioned_user_afk) {
                const post = new EmbedBuilder();
                post.setTitle(':warning: User is AFK').setColor(Colors.Yellow);
                if (mentioned_user_afk.message) {
                    post.setDescription(`**Reason:** ${mentioned_user_afk.message}`);
                }
                await message.reply({
                    embeds: [post],
                    allowedMentions: { parse: [] },
                });

                mentioned_user_afk.mentions.push(message.url);
                await this.db.save(mentioned_user_afk);
            }
        }
    }
}
