# Geliştirme Rehberi

Bu rehber, geliştirme ortamını kurma, botu yapılandırma ve yerel makinenizde çalıştırma sürecinde size yol gösterecektir.

## Ön Koşullar

* [Bun](https://bun.sh/)
* [Node.js](https://nodejs.org/en/) (bazı betikler için)
* [Git](https://git-scm.com/)
* [Docker](https://www.docker.com/) ve [Docker Compose](https://docs.docker.com/compose/) (veritabanı için)

## Kurulum

1. **Depoyu klonlayın:**

    ```bash
    git clone https://github.com/LibreTurks/usmanagabot.git
    cd usmanagabot
    ```

2. **Bağımlılıkları yükleyin:**

    ```bash
    bun install
    ```

3. **Veritabanını kurun:**
    Proje, Docker kullanılarak kolayca çalıştırılabilen bir PostgreSQL veritabanı kullanır.

    ```bash
    docker-compose up -d
    ```

## Yapılandırma

1. **Bot Yapılandırması:**
    `config` dizininde örnek dosyayı kopyalayarak bir `bot.jsonc` dosyası oluşturun:

    ```bash
    cp config/bot-example.jsonc config/bot.jsonc
    ```

    `config/bot.jsonc` dosyasını düzenleyin ve gerekli alanları doldurun:
    * `app_id`: Discord uygulama kimliğiniz.
    * `token`: Discord bot token'ınız.
    * `management`: Bot yönetimi amacıyla bir sunucu, kanal ve kullanıcı kimlikleri.

2. **Veritabanı Yapılandırması:**
    `config` dizininde bir `database.jsonc` dosyası oluşturun:

    ```bash
    cp config/database-example.jsonc config/database.jsonc
    ```

    `database.jsonc` içindeki varsayılan değerler, sağlanan `docker-compose.yml` ile çalışacak şekilde yapılandırılmıştır. Farklı bir veritabanı kurulumu kullanmıyorsanız bunları değiştirmeniz gerekmez.

## Botu Çalıştırma

Kurulumu ve yapılandırmayı tamamladıktan sonra, botu aşağıdaki komutla başlatabilirsiniz:

```bash
bun start
```

## Betikler

`package.json` dosyası, geliştirme için birkaç yararlı betik içerir:

* `eslint`: Kod tabanını hatalar için denetleyin.
* `eslint:fix`: Lint hatalarını otomatik olarak düzeltin.
* `prettier`: Kod tabanının biçimlendirmesini kontrol edin.
* `prettier:fix`: Biçimlendirme sorunlarını otomatik olarak düzeltin.
* `typeorm:migration:create`: Yeni bir veritabanı migrasyonu oluşturun.
* `typeorm:migration:generate`: Varlıklarınızdan yeni bir migrasyon oluşturun.
* `typeorm:migration:run`: Bekleyen tüm migrasyonları çalıştırın.
* `typeorm:migration:revert`: Son yürütülen migrasyonu geri alın.
