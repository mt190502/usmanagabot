# Proje Yapısı

Bu belge, projenin dizin yapısına ayrıntılı bir genel bakış sunarak her dosya ve klasörün amacını açıklamaktadır.

```bash
.
├── config/
│   ├── bot-example.jsonc
│   └── database-example.jsonc
├── docs/
│   ├── en/
│   └── tr/
├── scripts/
│   └── generate_language_keys.js
├── src/
│   ├── commands/
│   ├── events/
│   ├── localization/
│   ├── services/
│   ├── types/
│   └── utils/
├── .dockerignore
├── .envrc.example
├── .gitignore
├── .prettierrc.json
├── bun.lock
├── docker-compose.yml
├── Dockerfile
├── eslint.config.mjs
├── flake.nix
├── LICENSE
├── package.json
├── shell.nix
├── tsconfig.json
└── typeorm.config.ts
```

## Kök Dizini

* `config/`: Örnek yapılandırma dosyalarını içerir.
  * `bot-example.jsonc`: Bot için örnek yapılandırma.
  * `database-example.jsonc`: Veritabanı için örnek yapılandırma.
* `docs/`: Proje dokümantasyonunu içerir.
  * `en/`: İngilizce dokümantasyon.
  * `tr/`: Türkçe dokümantasyon.
* `scripts/`: Proje için yardımcı betikleri içerir.
  * `generate_language_keys.js`: Anahtar oluşturmak için bir betik.
* `src/`: Uygulamanın ana kaynak kodu.
* `.dockerignore`: Bir Docker görüntüsü oluştururken yoksayılacak dosyaları ve dizinleri belirtir.
* `.envrc.example`: Örnek ortam değişkenleri dosyası.
* `.gitignore`: Git tarafından yoksayılacak dosyaları ve dizinleri belirtir.
* `.prettierrc.json`: Prettier için yapılandırma dosyası.
* `bun.lock`: Tutarlı bağımlılıkları sağlayan Bun için kilit dosyası.
* `docker-compose.yml`: Bir Docker uygulaması için hizmetleri, ağları ve birimleri tanımlar.
* `Dockerfile`: Bir Docker görüntüsü oluşturmak için bir dizi talimat içeren bir betik.
* `eslint.config.mjs`: ESLint için yapılandırma dosyası.
* `flake.nix` / `shell.nix`: Tekrarlanabilir bir geliştirme ortamı tanımlayan Nix paket yöneticisi için dosyalar.
* `LICENSE`: Projenin lisans dosyası.
* `package.json`: Projenin meta verilerini, bağımlılıklarını ve betiklerini tanımlar.
* `tsconfig.json`: TypeScript derleyicisi için yapılandırma dosyası.
* `typeorm.config.ts`: TypeORM için yapılandırma dosyası.

## `src/` Dizini

* `commands/`: Botun tüm komutlarını içerir, kategoriye göre alt dizinler halinde düzenlenmiştir.
  * `index.ts`: Tüm komutları dinamik olarak yükleyen komut yükleyici.
* `events/`: Botun tüm etkinlik işleyicilerini içerir.
  * `index.ts`: Tüm etkinlik işleyicilerini dinamik olarak yükleyen etkinlik yükleyici.
* `localization/`: Farklı diller için yerelleştirme dosyalarını içerir.
* `services/`: Botun temel hizmetlerini içerir.
  * `client.ts`: Discord.js istemcisini başlatır ve yönetir.
  * `config.ts`: Botun yapılandırmasını yönetir.
  * `database.ts`: Veritabanı bağlantısını yönetir.
  * `logger.ts`: Bot için özel bir günlükçü.
  * `translator.ts`: Botun yerelleştirmesini yönetir.
* `types/`: TypeScript tür tanımlarını, veritabanı varlıklarını ve diğer yapısal türleri içerir.
  * `database/`: Tüm veritabanı ile ilgili türleri içerir.
    * `entities/`: TypeORM varlık tanımları.
    * `migrations/`: Veritabanı taşıma betikleri.
    * `subscribers/`: TypeORM etkinlik aboneleri.
  * `decorator/`: Özel dekoratörleri içerir.
  * `structure/`: Komutlar, etkinlikler vb. için temel yapıları içerir.
* `utils/`: Uygulama boyunca kullanılan yardımcı işlevleri içerir.
