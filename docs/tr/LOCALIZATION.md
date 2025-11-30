# Yerelleştirme Rehberi

Bu kılavuz, botun yerelleştirme (l10n) sisteminin nasıl çalıştığını ve yeni dillerin nasıl ekleneceğini veya mevcut çevirilerin nasıl değiştirileceğini açıklamaktadır.

## Genel Bakış

Yerelleştirme sistemi, `Translator` hizmeti (`src/services/translator.ts`) tarafından yönetilir. Bu hizmet, hızlı erişim için başlangıçta tüm çeviri dosyalarını belleğe yükler. Sunucu başına dil ayarlarını destekler ve eksik çeviriler için sağlam bir geri dönüş mekanizması içerir.

Çeviriler, `src/localization` dizininde, dile ve kategoriye göre düzenlenmiş JSONC (`.jsonc`) dosyalarında saklanır.

## Dosya Yapısı

Yerelleştirme dizini aşağıdaki gibi yapılandırılmıştır:

```bash
src/localization/
├── en-US/
│   ├── commands/
│   ├── events/
│   ├── services/
│   └── system/
└── tr/
    ├── commands/
    ├── events/
    ├── services/
    └── system/
```

* Her dilin kendi dizini vardır (ör. `en-US`, `tr`).
* Her dil dizini içinde, çeviriler ayrıca kategorilere ayrılmıştır: `commands`, `events`, `services`, ve `system`.

## Yeni Bir Dil Ekleme

1. **`SupportedLanguages`'a Ekle:**
    `src/services/translator.ts` dosyasını açın ve yeni dili `SupportedLanguages` enum'una ekleyin. `discord.js`'den yerel kodları kullanın.

    ```typescript
    // src/services/translator.ts
    export enum SupportedLanguages {
        // ...
        FR = Locale.French, // Örnek
    }
    ```

2. **Yeni Bir Dizin Oluştur:**
    `src/localization` içinde, eklediğiniz dil koduyla aynı ada sahip yeni bir dizin oluşturun (ör. `fr`).

3. **Dosyaları Kopyala ve Çevir:**
    Mevcut bir dil dizininin (ör. `en-US`) içeriğini yeni dil dizininize kopyalayın ve her dosyadaki değerleri çevirin.

## Çevirileri Yönetme

Belirli bir komut, etkinlik veya hizmet için çeviriler, ilgili bir `.jsonc` dosyasında saklanır. Dosya yolu, kaynak dosyanın yolunu yansıtır.

Örneğin, `ping` komutunun (`src/commands/core/ping.ts`) çevirileri `src/localization/[lang]/commands/core/ping.jsonc` adresinde bulunur.

### Örnek Çeviri Dosyası

İşte `ping` komutu için bir çeviri dosyası örneği:

```jsonc
// src/localization/tr/commands/core/ping.jsonc
{
    "ping": {
        "name": "ping",
        "pretty_name": "Ping",
        "description": "Botun yanıt süresini ölçer.",
        "execute": {
            "measuring": "Gecikme ölçülüyor..."
        }
    }
}
```

### Çevirmeni Kullanma

Bir komut veya etkinlik içinde, çevrilmiş bir dize almak için `t` yardımcı işlevini kullanabilirsiniz. Bu işlev, `BaseCommand` ve `BaseEvent` sınıflarında otomatik olarak kullanılabilir.

```typescript
// Ping komutundan örnek
export default class PingCommand extends BaseCommand {
    // ...
    public async execute(interaction: CommandInteraction): Promise<void> {
        // 'execute.measuring' anahtarı otomatik olarak 'ping' komutunun
        // çeviri dosyasından aranır.
        const msg = await interaction.reply(
            this.t.commands({ key: 'execute.measuring' })
        );
    }
}
```

### Yer Tutucular

Çevirmen, çalışma zamanında dinamik değerlerle değiştirilen yer tutucuları destekler.

```jsonc
// Yer tutuculu örnek
"welcome_message": "Sunucuya hoş geldin, {user}!"
```

```typescript
// Yer tutucuyu kullanma
this.t.system({
    key: 'welcome_message',
    replacements: { user: interaction.user.username }
});
