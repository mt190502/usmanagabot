import { ActionRowBuilder, ModalActionRowComponentBuilder, ModalBuilder, StringSelectMenuBuilder, TextChannel, TextInputBuilder, TextInputStyle, Webhook, WebhookClient } from "discord.js";
import { DatabaseConnection } from "../../main";
import { Guilds } from "../../types/database/guilds";
import { Command_t } from "../../types/interface/commands";
import { Logger } from "../../utils/logger";

const settings = async (interaction: any) => {
    const guild = await DatabaseConnection.manager.findOne(Guilds, { where: { gid: interaction.guild.id } });
    let message_logger_status = guild.message_logger ? 'Disable' : 'Enable';
    const channel_id = new TextInputBuilder().setCustomId('channel_id').setLabel('Channel ID').setStyle(TextInputStyle.Short);

    const createMenuOptions = () => [
        { label: `${message_logger_status} Message Logger`, description: `${message_logger_status} the message logger`, value: 'settings:logger:1' },
        { label: 'Change Message Logger Channel', description: 'Change the channel where message logs are sent', value: 'settings:logger:2' },
        { label: 'Back', description: 'Go back to the previous menu', value: 'settings' },
    ];

    let menu = new StringSelectMenuBuilder().setCustomId('settings:logger:1').addOptions(...createMenuOptions());
    let row = new ActionRowBuilder().addComponents(menu);

    const menu_path = interaction.values ? interaction.values[0].split(':').at(-1) : interaction.customId.split(':').at(-1);
    switch (menu_path) {
        case '1':
            if (message_logger_status === 'Enable') {
                guild.message_logger = true;
                message_logger_status = 'Disable';
            } else {
                guild.message_logger = false;
                message_logger_status = 'Enable';
            }
            await DatabaseConnection.manager.save(guild);

            menu = new StringSelectMenuBuilder().setCustomId('settings:logger:0').addOptions(...createMenuOptions());
            row = new ActionRowBuilder().addComponents(menu);
            await interaction.update({
                content: `Message logger ${guild.message_logger ? 'enabled' : 'disabled'}`,
                components: [row]
            });
            break;
        case '2':
            await interaction.showModal(new ModalBuilder().setCustomId(`settings:logger:21`).setTitle('Message Logger Channel ID').addComponents(
                new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(channel_id.setValue(guild.message_logger_channel_id ?? '')),
            ));
            break;
        case '21':
            if (interaction.fields.getTextInputValue('channel_id') != guild.message_logger_channel_id) {
                guild.message_logger_channel_id = interaction.fields.getTextInputValue('channel_id');
                if ((guild.message_logger_webhook_id !== null) && (guild.message_logger_webhook_token !== null)) {
                    const webhook_client = new WebhookClient({ id: guild.message_logger_webhook_id, token: guild.message_logger_webhook_token });
                    webhook_client.delete().then(() => {
                        Logger('info', `Deleted webhook ${guild.message_logger_webhook_id}`);
                    }).catch((error) => {
                        Logger('warn', `Error deleting webhook ${guild.message_logger_webhook_id}`);
                    });
                }

                const channel: TextChannel = await interaction.guild.channels.fetch(guild.message_logger_channel_id);
                await channel.createWebhook({ name: 'Message Logger' }).then((webhook: Webhook) => {
                    guild.message_logger_webhook_id = webhook.id;
                    guild.message_logger_webhook_token = webhook.token;

                    Logger('info', `Created webhook ${webhook.id} with name ${webhook.name}`);
                });
            } else {
                await interaction.update({ content: 'Old channel ID and New channel ID are the same', components: [row] });
            }

            await DatabaseConnection.manager.save(guild).then(() => {
                interaction.update({ content: `Message logger channel set to <#${guild.message_logger_channel_id}>`, components: [row] });
            }).catch((error) => {
                interaction.update({ content: 'Error setting message logger channel', components: [row] });
            });
            break;
        default:
            await interaction.update({
                content: 'Select a setting',
                components: [row]
            });
            break;
    }
}
export default {
    enabled: true,
    name: 'logger',
    type: 'customizable',
    description: 'Message logger settings wrapper.',

    category: 'pseudo',
    cooldown: 0,
    usage: '/settings',

    settings: settings,
} as Command_t;