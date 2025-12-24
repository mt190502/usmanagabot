# Dağıtım Rehberi

Bu kılavuz, UsmanAga botunu Docker ve Docker Compose kullanarak bir üretim ortamına nasıl dağıtacağınızı açıklamaktadır.

## Ön Koşullar

* Docker ve Docker Compose'un kurulu olduğu bir sunucu.
* Sunucuda kurulu bir Git istemcisi.
* Üretime hazır bir PostgreSQL veritabanı. Geliştirme için `docker-compose.yml` dosyasındaki veritabanını kullanabilirsiniz, ancak üretim için yönetilen bir veritabanı hizmeti veya düzgün yapılandırılmış bir PostgreSQL sunucusu kullanmanız önerilir.

## Dağıtım Adımları

1. **Depoyu Klonlayın:**
    Depoyu sunucunuza klonlayın:

    ```bash
    git clone https://github.com/LibreTurks/usmanagabot.git
    cd usmanagabot
    ```

2. **Ortam Değişkenlerini Yapılandırın:**
    Botu üretim için yapılandırmanın önerilen yolu ortam değişkenleridir. `docker-compose.yml` dosyası, ortam değişkenlerini bot ve veritabanı hizmetlerine geçirecek şekilde ayarlanmıştır.

    Projenin kök dizininde bir `.envrc` dosyası oluşturun:

    ```bash
    cp .envrc.example .envrc
    ```

    `.envrc` dosyasını düzenleyin ve aşağıdaki değerleri sağlayın:

    ```bash
    # Bot Yapılandırması
    BOT__APP_ID=discord_uygulama_id'niz
    BOT__TOKEN=discord_bot_token'ınız
    BOT__MANAGEMENT__CHANNEL_ID=yonetim_kanal_id'niz
    BOT__MANAGEMENT__GUILD_ID=yonetim_sunucu_id'niz
    BOT__MANAGEMENT__USER_ID=yonetim_kullanici_id'niz

    # Veritabanı Yapılandırması
    DB__HOST=veritabani_host'unuz
    DB__PORT=veritabani_port'unuz
    DB__USERNAME=veritabani_kullanici_adiniz
    DB__PASSWORD=veritabani_sifreniz
    DB__DATABASE=veritabani_adiniz
    ```

    **Not:** Çift alt çizgi `__`, iç içe geçmiş yapılandırma anahtarlarını ayırmak için kullanılır. Örneğin, `BOT__MANAGEMENT__CHANNEL_ID`, `bot.jsonc` dosyasındaki `management.channel_id`'ye karşılık gelir.

3. **Docker Compose ile Derleyin ve Çalıştırın:**
    Sağlanan `docker-compose.yml` dosyası, botun Docker görüntüsünü oluşturacak ve bir PostgreSQL veritabanı ile birlikte bir hizmet olarak çalıştıracak şekilde yapılandırılmıştır.

    Hizmetleri derlemek ve başlatmak için şunu çalıştırın:

    ```bash
    docker-compose up --build -d
    ```

    * `--build`: Kodda değişiklik yaptığınızda kullanışlı olan Docker görüntüsünün yeniden oluşturulmasını zorlar.
    * `-d`: Hizmetleri ayrılmış modda (arka planda) çalıştırır.

4. **Veritabanı Taşımalarını Çalıştırın:**
    Hizmetler başladıktan sonra, veritabanı şemasını kurmak için veritabanı taşımalarını çalıştırmanız gerekir.

    Bunu, çalışan bot kapsayıcısının içinde taşıma komutunu yürüterek yapabilirsiniz:

    ```bash
    docker-compose exec bot bun run typeorm:migration:run
    ```

## Botu Güncelleme

Botu depodaki en son değişikliklerle güncellemek için:

1. **En son kodu çekin:**

    ```bash
    git pull
    ```

2. **Hizmetleri yeniden derleyin ve yeniden başlatın:**

    ```bash
    docker-compose up --build -d
    ```

3. **Yeni taşımaları çalıştırın:**

    ```bash
    docker-compose exec bot bun run typeorm:migration:run
    ```

## Üretimle İlgili Hususlar

* **Veritabanı:** Bir üretim dağıtımı için, `docker-compose.yml` dosyasında sağlanandan ziyade yönetilen bir veritabanı hizmeti (ör. Amazon RDS, Google Cloud SQL) veya düzgün şekilde güvenliği sağlanmış ve yedeklenmiş bir PostgreSQL sunucusu kullanmanız şiddetle tavsiye edilir.
* **Günlükleme:** Varsayılan olarak, bot konsola günlük kaydeder ve bu `docker-compose logs -f bot` ile görüntülenebilir. Bir üretim kurulumu için, günlükleri bir dosyaya veya bir günlük yönetimi hizmetine göndermek gibi daha sağlam bir günlükleme çözümü yapılandırmak isteyebilirsiniz.
