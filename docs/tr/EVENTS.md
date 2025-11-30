# Etkinlik Oluşturma

Bu kılavuz, bot için yeni etkinlik işleyicilerinin nasıl oluşturulacağını açıklamaktadır. Etkinlik sistemi, botun hazır olması, yeni bir mesaj gönderilmesi veya bir kullanıcının bir komutla etkileşime girmesi gibi Discord.js istemcisinden gelen olayları dinlemenizi ve bunlara tepki vermenizi sağlar.

## Etkinlik Yapısı

Tüm etkinlik işleyicileri `src/events` dizininde bulunur. Her etkinlik işleyicisi, `BaseEvent` sınıfını genişleten bir sınıftır.

### `BaseEvent`

`BaseEvent` sınıfı, tüm etkinlik işleyicileri için temel yapıyı sağlar. Aşağıdaki özellikleri içerir:

* `type`: Bu işleyicinin sorumlu olduğu istemci etkinliğinin türü (ör. `Events.ClientReady`, `Events.InteractionCreate`).
* `once`: `true` ise, etkinlik yalnızca bir kez işlenir.
* `execute(...args)`: Etkinlik işleyicisinin ana yürütme mantığı.

## Basit Bir Etkinlik İşleyicisi Oluşturma

İşte bot hazır olduğunda bir kez çalışan basit bir etkinlik işleyicisi (`ready`) örneği:

```typescript
// src/events/ready.ts

import { BaseEvent } from '@src/types/structure/event';
import { Client, Events } from 'discord.js';

export default class ReadyEvent extends BaseEvent<Events.ClientReady> {
    constructor() {
        super({ enabled: true, type: Events.ClientReady, once: true });
    }

    public async execute(client: Client<true>): Promise<void> {
        this.log.send('events', 'ready', 'log', 'success', { name: client.user.tag });
    }
}
```

**Yeni bir etkinlik işleyicisi oluşturmak için:**

1. `src/events` dizininde yeni bir TypeScript dosyası oluşturun.
2. `discord.js`'nin `Events` enum'undan etkinlik türünü genel tür olarak belirterek `BaseEvent` sınıfını genişleten bir sınıf oluşturun.
3. `constructor` içinde, `type` ve `once` olup olmayacağı da dahil olmak üzere etkinliğin seçenekleriyle `super()` çağrısı yapın.
4. `execute` yöntemini etkinlik işleme mantığınızla uygulayın. Bu yöntemin argümanları, Discord.js'deki ilgili etkinliğin argümanlarıyla eşleşecektir.

## Interaction Create Etkinliği

`src/events/interaction.ts` dosyasında bulunan `interactionCreate` etkinliği, tüm komut ve bileşen etkileşimleri için merkezi bir merkez görevi gören daha karmaşık bir örnektir.

### Ana Sorumluluklar

* **Komut Yönlendirme:** Hangi komutun çağrıldığını belirler ve onu yürütür.
* **Bekleme Süresi Yönetimi:** Kullanıcıların komutları spamlemesini önlemek için bekleme sürelerini uygular.
* **Bileşen İşleme:** Düğmelerden, seçim menülerinden ve modallardan gelen etkileşimleri uygun komuta veya işleyiciye devreder.

Bir kullanıcı bir bileşenle (düğme gibi) etkileşime girdiğinde, `interactionCreate` etkinliği, etkileşimi yönlendirmek için bir `customId` kullanır. `customId`, karmaşık etkileşimleri işlemek için esnek ve güçlü bir yol sağlayan `ad_alanı:komut_adı:arg1:arg2...` biçimini izler.
