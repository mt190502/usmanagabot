# Komut Oluşturma

Bu kılavuz, bot için yeni uygulama komutlarının nasıl oluşturulacağını açıklamaktadır. Komut sistemi, hem basit hem de özelleştirilebilir, sunucuya özel ayarlara sahip karmaşık komutları destekleyen modüler ve esnek olacak şekilde tasarlanmıştır.

## Komut Yapısı

Tüm komutlar `src/commands` dizininde bulunur ve kategorilerine göre alt dizinler halinde düzenlenir (ör. `core`, `admin`, `misc`). Her komut, `BaseCommand` veya `CustomizableCommand` sınıflarından birini genişleten bir sınıftır.

### `BaseCommand`

`BaseCommand` sınıfı, tüm komutların temelidir. Bir komutun çalışması için gereken temel özellikleri ve yöntemleri sağlar, bunlar arasında:

* `name`: Komutun benzersiz adı.
* `description`: Komutun ne yaptığına dair kısa bir açıklama.
* `execute(interaction)`: Komutun ana yürütme mantığı.

### `CustomizableCommand`

`CustomizableCommand` sınıfı, `BaseCommand` sınıfını genişletir ve sunucuya özel ayarlar gerektiren komutlar için kullanılır. Aşağıdakiler için işlevsellik ekler:

* `prepareCommandData(guild_id)`: Bir sunucu için komuta özgü verileri hazırlama (ör. varsayılan veritabanı girişleri oluşturma).
* `settingsUI(interaction)`: Komut için bir ayarlar kullanıcı arayüzü oluşturma.

## Basit Bir Komut Oluşturma

İşte `BaseCommand` sınıfını genişleten basit bir komut (`ping`) örneği:

```typescript
// src/commands/core/ping.ts

import { CommandInteraction } from 'discord.js';
import { BaseCommand } from '../../types/structure/command';

export default class PingCommand extends BaseCommand {
    constructor() {
        super({ name: 'ping' });
    }

    public async execute(interaction: CommandInteraction): Promise<void> {
        const msg = await interaction.reply('Gecikme ölçülüyor...');
        const latency = msg.createdTimestamp - interaction.createdTimestamp;
        await msg.edit(`Pong! Gecikme ${latency}ms.`);
    }
}
```

**Yeni bir basit komut oluşturmak için:**

1. `src/commands` dizininin uygun alt dizininde yeni bir TypeScript dosyası oluşturun.
2. `BaseCommand` sınıfını genişleten bir sınıf oluşturun.
3. `constructor` içinde, komutun seçenekleriyle (en azından `name`) `super()` çağrısı yapın. `description` ve diğer özellikler otomatik olarak yerelleştirilir.
4. `execute` yöntemini komutunuzun mantığıyla uygulayın.

## Daha Karmaşık Bir Komut Oluşturma

Eğik çizgi komut seçenekleri, içerik menüleri veya onay istemleri gibi daha gelişmiş özellikler gerektiren komutlar için sağlanan oluşturucuları ve dekoratörleri kullanabilirsiniz.

İşte birkaç gelişmiş özelliği gösteren `purge` komutundan bir alıntı:

```typescript
// src/commands/admin/purge.ts

import {
    ApplicationCommandType,
    ButtonInteraction,
    CommandInteraction,
    ContextMenuCommandBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import { CommandQuestionPrompt } from '../../types/decorator/commandquestionprompt';
import { BaseCommand } from '../../types/structure/command';

export default class PurgeCommand extends BaseCommand {
    constructor() {
        super({ name: 'purge', is_admin_command: true });

        // Eğik çizgi komutuna bir dize seçeneği ekleyin
        (this.base_cmd_data as SlashCommandBuilder)
            .addStringOption((o) =>
                o.setName('message_id').setDescription('Temizlenecek mesaj.')
            );

        // Bir içerik menüsü komutu oluşturun
        this.push_cmd_data = new ContextMenuCommandBuilder()
            .setName(this.pretty_name)
            .setType(ApplicationCommandType.Message);
    }

    @CommandQuestionPrompt({ message: 'Mesajları temizlemek istediğinizden emin misiniz?' })
    public async execute(interaction: ButtonInteraction | CommandInteraction): Promise<void> {
        // ... yürütme mantığı ...
    }
}
```

### Ana Özellikler

* **Eğik Çizgi Komut Seçenekleri:** Komutunuza seçenekler eklemek için `this.base_cmd_data` içindeki `SlashCommandBuilder`'ı kullanın.
* **İçerik Menüleri:** Bir `ContextMenuCommandBuilder` oluşturun ve `this.push_cmd_data` kullanarak komutun verilerine ekleyin.
* **Onay İstemleri:** Komutu çalıştırmadan önce kullanıcı onayı gerektirmek için `execute` yönteminde `@CommandQuestionPrompt` dekoratörünü kullanın. `execute` yöntemi, ilk etkileşim için bir kez ve kullanıcı onaylarsa ikinci kez çağrılır.

## Yerelleştirme

Komut sistemi, `Translator` hizmetiyle tam olarak entegre edilmiştir. `constructor` içinde bir komutun özelliklerini tanımladığınızda, `pretty_name`, `description` ve `help` alanları, yerelleştirme dosyalarınızdaki anahtarlar kullanılarak otomatik olarak çevrilir.

Örneğin, `super({ name: 'ping', description: 'description' })`, komutun yerelleştirme dosyasından `ping.description` anahtarını kullanacaktır.
