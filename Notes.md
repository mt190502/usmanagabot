# Button Builder Example
    ```typescript
        const exec = async (interaction: CommandInteraction) => {
        const button1 = new ButtonBuilder().setCustomId('settings:button1').setLabel('Button 1').setStyle(ButtonStyle.Danger);
        const button2 = new ButtonBuilder().setCustomId('settings:button2').setLabel('Button 2').setStyle(ButtonStyle.Primary);
        const button3 = new ButtonBuilder().setCustomId('settings:button3').setLabel('Button 3').setStyle(ButtonStyle.Secondary).setDisabled(true);
        const button4 = new ButtonBuilder().setCustomId('settings:button4').setLabel('Button 4').setStyle(ButtonStyle.Success);
        // const button5 = new ButtonBuilder().setCustomId('settings:button5').setLabel('Button 5').setStyle(ButtonStyle.Link).setURL('https://google.com');

        const row = new ActionRowBuilder().addComponents([button1, button2, button3, button4]);

        await interaction.reply({ content: 'Settings', components: [row as any] });
    };

    const postExec = async (interaction: ButtonInteraction) => {
        await interaction.reply({ content: `Button ${interaction.customId.split(':')[1]} clicked!`, ephemeral: true });
    };
    ```

# Embed Builder Example
    ```typescript
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Some title')
            .setURL('https://discord.js.org/')
            .setAuthor({ name: 'Some name', iconURL: 'https://i.imgur.com/AfFp7pu.png', url: 'https://discord.js.org' })
            .setDescription('Some description here')
            .setThumbnail('https://i.imgur.com/AfFp7pu.png')
            .addFields(
                { name: 'Regular field title', value: 'Some value here' },
                { name: '\u200B', value: '\u200B' },
                { name: 'Inline field title', value: 'Some value here', inline: true },
                { name: 'Inline field title', value: 'Some value here', inline: true },
            )
            .addFields({ name: 'Inline field title', value: 'Some value here', inline: true })
            .setImage('https://i.imgur.com/AfFp7pu.png')
            .setTimestamp()
            .setFooter({ text: 'Some footer text here', iconURL: 'https://i.imgur.com/AfFp7pu.png' });
    
        await interaction.channel.send({ embeds: [embed] });
    ```

# Modal Builder Example
    ```typescript
    const exec = async (interaction: CommandInteraction) => {
        const modal = new ModalBuilder().setCustomId('settings').setTitle('Settings');
        const favoriteColor = new TextInputBuilder().setCustomId('favorite_color').setLabel('Favorite Color').setStyle(TextInputStyle.Short);
        const hobbiesInput = new TextInputBuilder().setCustomId('hobbies').setLabel('Hobbies').setStyle(TextInputStyle.Paragraph);

        const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(favoriteColor);
        const secondActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(hobbiesInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
    };

    const postExec = async (interaction: ModalSubmitInteraction) => {
        const favoriteColor = interaction.fields.getTextInputValue('favorite_color');
        const hobbies = interaction.fields.getTextInputValue('hobbies');

        await interaction.reply(`Your favorite color is ${favoriteColor} and your hobbies are ${hobbies}`);
    };
    ```

# Select Menu Builder Example
    ```typescript
        const exec = async (interaction: any) => {
        const select = new StringSelectMenuBuilder()
            .setCustomId('settings')
            .setPlaceholder('Make a selection!')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Bulbasaur')
                    .setDescription('The dual-type Grass/Poison Seed Pokémon.')
                    .setValue('bulbasaur'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Charmander')
                    .setDescription('The Fire-type Lizard Pokémon.')
                    .setValue('charmander'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Squirtle')
                    .setDescription('The Water-type Tiny Turtle Pokémon.')
                    .setValue('squirtle'),
            );
    
            const row = new ActionRowBuilder().addComponents(select);
    
            await interaction.reply({ content: 'Pong!', components: [row] });
        };

        const postExec = async (interaction: SelectMenuInteraction) => {
            await interaction.reply(`You selected ${interaction.values[0]}`);
        };
    ```