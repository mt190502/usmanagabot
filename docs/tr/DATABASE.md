# Veritabanı Rehberi

Bu kılavuz, veritabanı kurulumuna, varlıklarla nasıl çalışılacağına ve veritabanı taşımalarının nasıl yönetileceğine genel bir bakış sunmaktadır.

## Veritabanı Kurulumu

Proje, bir [PostgreSQL](https://www.postgresql.org/) veritabanı ile etkileşim kurmak için [TypeORM](https://typeorm.io/) kullanır. Veritabanı bağlantısı `typeorm.config.ts` dosyasında yapılandırılır ve uygulamanın veritabanı hizmeti `src/services/database.ts` tarafından yönetilir.

Yerel geliştirme için, sağlanan `docker-compose.yml` dosyası kullanılarak bir PostgreSQL veritabanı kolayca çalıştırılabilir:

```bash
docker-compose up -d
```

## Varlıklar

Veritabanı varlıkları, `src/types/database/entities` dizinindeki sınıflar olarak tanımlanır. Bu sınıflar veritabanı tablolarına ve özellikleri tablo sütunlarına eşlenir.

İşte `Users` varlığına bir örnek:

```typescript
// src/types/database/entities/users.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class Users {
    @PrimaryColumn('bigint')
    uid: bigint;

    @Column('varchar')
    name: string;
}
```

Yeni bir varlık oluşturmak için:

1. `src/types/database/entities` içinde yeni bir dosya oluşturun.
2. Bir sınıf tanımlayın ve `@Entity()` ile süsleyin.
3. Tablonun yapısını ve ilişkilerini tanımlamak için sınıfa özellikler ekleyin ve bunları `@PrimaryColumn()`, `@Column()`, `@OneToMany()`, `@ManyToOne()` vb. ile süsleyin.

## Veritabanına Erişme

Bir komut veya hizmet içinde, `DatabaseManager` örneği sağlayan `db` alıcısı aracılığıyla veritabanına erişebilirsiniz.

```typescript
// Bir komutta bir kullanıcı bulma örneği
import { Users } from '@src/types/database/entities/users';

// ... bir komutun execute yöntemi içinde ...
const user = await this.db.findOne(Users, { where: { uid: interaction.user.id } });
```

## Taşımalar

Veritabanı taşımaları, veritabanı şemasını varlıklarınızla senkronize tutmak için kullanılır. Taşımalar `src/types/database/migrations` dizininde saklanır.

Proje, taşımaları yönetmenize yardımcı olacak birkaç npm betiği içerir:

* **`bun run typeorm:migration:create`**: Yeni, boş bir taşıma dosyası oluşturur. Daha sonra `up` ve `down` yöntemlerine SQL sorgularınızı ekleyebilirsiniz.

* **`bun run typeorm:migration:generate`**: Veritabanını varlıklarınızla senkronize etmek için gereken SQL ifadeleriyle otomatik olarak yeni bir taşıma dosyası oluşturur. Bu, taşıma oluşturmanın önerilen yoludur.

    **Örnek:**
    Yeni bir varlık ekledikten veya mevcut bir varlığı değiştirdikten sonra şunu çalıştırın:

    ```bash
    bun run typeorm:migration:generate -- -n YeniTasimam
    ```

* **`bun run typeorm:migration:run`**: Bekleyen tüm taşımaları yürüterek değişiklikleri veritabanına uygular.

* **`bun run typeorm:migration:revert`**: Son yürütülen taşımayı geri alarak değişiklikleri geri alır.
