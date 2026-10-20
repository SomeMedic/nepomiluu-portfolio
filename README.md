# Портфолио Ульяны Непомилуевой

Production: [nepomiluu.art](https://nepomiluu.art). Автоматический выпуск через GitHub Actions и Compose описан в [production-deployment.md](docs/production-deployment.md).

Next.js App Router + Nest + MongoDB, RU/EN, фиксированная главная из семи секций и CMS кейсов. pnpm-монорепозиторий: `apps/web`, `apps/api`, `packages/contracts`. Загруженные изображения хранятся локально в постоянном Docker volume. Аналитика и сторонние трекеры не подключены.

Визуальная основа — [утверждённые макеты](design/README.md), текстовые решения — [portfolio-decisions.md](design/portfolio-decisions.md). Для Clypse и клиники Фомина предоставлены презентационные материалы проектов: они подключены к двуязычным кейсам и главной. Оба стартовых кейса заполнены в seed для публикации; существующие записи CMS seed не перезаписывает. Текущий журнал проверки — [implementation-progress.md](docs/implementation-progress.md).

## Локальный запуск

Нужны Node.js **24 LTS**, pnpm **10.20.0** и Docker Compose v2.24.4+ (Linux containers). Базовые образы закреплены точной версией и SHA-256 manifest digest; для обновления меняйте оба после проверки. `.tools/` содержит только локальные игнорируемые инструменты, если они были скачаны для проверки.

```powershell
corepack enable
corepack prepare pnpm@10.20.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
docker compose -f compose.dev.yaml up -d --wait
pnpm dev
```

Откройте `http://localhost:3000/ru` или `/en`, CMS — `/admin`. Dev Mongo доступна только на `127.0.0.1:27017`; её данные находятся в отдельном volume `nepomiluu-dev_mongo-dev`. В development cookie работает по HTTP. В production требуется HTTPS.

Для Node portable на этой машине используйте точный путь Node и pnpm CLI: Windows shim `pnpm.cmd` иначе может выбрать глобальный Node 22. Это не меняет глобальные инструменты:

```powershell
$taskNode = Join-Path (Get-Location) '.tools/node-v24.22.0-win-x64/node.exe'
$taskPnpm = 'C:/Program Files/nodejs/node_modules/pnpm/bin/pnpm.cjs'
& $taskNode $taskPnpm install --frozen-lockfile
& $taskNode scripts/dev.mjs
```

`scripts/dev.mjs` загружает корневой `.env`, передаёт одинаковое окружение web/API, делает путь медиа абсолютным и запускает дочерний pnpm через текущий Node 24. Можно запустить только `node scripts/dev.mjs web` или `api`; `--check` выводит безопасную конфигурацию без секретов. Для нестандартной установки задайте `PNPM_CLI_PATH`. После запуска API проверьте `http://127.0.0.1:4000/api/health`.

В development задайте `PUBLIC_ORIGIN=http://localhost:3000`, `API_INTERNAL_URL=http://127.0.0.1:4000`, `WEB_INTERNAL_URL=http://127.0.0.1:3000` и случайный `INTERNAL_SECRET`. Если secret не задан или оставлен placeholder, dev wrapper создаёт общий временный секрет для обоих процессов. Не используйте production Mongo URI для локального режима. Публичные страницы в штатном режиме читают опубликованные данные API; явный `ALLOW_STATIC_CONTENT=true` включает отдельное локальное демонстрационное превью из seed-контента, которое не обращается к API. Для проверки CMS оставьте `false`. В production разрешены только данные CMS.

## Владелец и начальные данные

Регистрации и пароля по умолчанию нет. Для создания **или сброса** владельца используется одна серверная команда. Она заменяет пароль и отзывает все существующие сессии. Пароль передавайте через stdin, чтобы он не остался в истории команд. Остановите API перед CLI-записью и не выполняйте её одновременно с backup: контентная блокировка рассчитана на один процесс API.

Локальные команды `pnpm seed`, `pnpm admin:create` и `pnpm admin:reset` используют `scripts/cli.mjs`. Обязателен корневой `.env` с явно заданным `MONGODB_URI`: его значения перекрывают переменные, унаследованные от другого проекта. При отсутствии `.env` или URI команда откажется запускаться. `node scripts/cli.mjs seed --check` проверяет конфигурацию без подключения к БД и вывода секретов.

Локально, из корня, после настройки `.env`:

```powershell
$env:ADMIN_EMAIL = 'owner@example.com'
$taskPassword = Read-Host 'Новый пароль (не менее 12 символов)' -AsSecureString
$taskCredential = [System.Net.NetworkCredential]::new('', $taskPassword)
$taskCredential.Password | pnpm admin:create
Remove-Variable taskPassword,taskCredential
pnpm seed
```

Для portable Node используйте `$taskCredential.Password | & $taskNode scripts/cli.mjs admin:create` и `& $taskNode scripts/cli.mjs seed`. Сброс пароля выполняется через `admin:reset` с тем же скрытым вводом. Обёртка запускает API CLI через текущий Node 24 и pnpm; пароль поступает в stdin, не в аргументы.

Для постоянного окружения команды выполняются в одноразовом контейнере; скрытый ввод в Linux Bash:

```bash
docker compose --env-file /etc/nepomiluu/portfolio.env stop api
read -rsp 'Новый пароль: ' OWNER_PASSWORD; printf '\n'
printf '%s' "$OWNER_PASSWORD" | docker compose --env-file /etc/nepomiluu/portfolio.env run --rm --no-deps -T -e ADMIN_EMAIL=owner@example.com api node dist/cli.js owner
unset OWNER_PASSWORD
docker compose --env-file /etc/nepomiluu/portfolio.env run --rm --no-deps -T api node dist/cli.js seed
docker compose --env-file /etc/nepomiluu/portfolio.env up -d api
```

Seed идемпотентен: существующие проекты и редакторские изменения сохраняются. Начальные статусы проверяйте в CMS: неполные проекты остаются черновиками. После реального наполнения выберите опубликованные кейсы для двух слотов главной.

## Работа в CMS

1. Войдите в `/admin`, создайте проект с уникальным slug и заполните русскую и английскую версии.
2. Загрузите реальные изображения. API создаст WebP `thumb`, `page`, `full`; заполните alt на обоих языках. Принимаются статичные JPEG/PNG/WebP/AVIF до 20 MiB и 40 млн пикселей.
3. Соберите кейс из подготовленных блоков: текст, изображение, галерея, текст с изображением, сравнение, аннотации. Сохранение меняет черновик; опубликованный снимок остаётся прежним.
4. Проверьте оба авторизованных preview и опубликуйте. RU/EN публикуются одним атомарным снимком. Неполные обязательные поля, изображения и alt блокируют публикацию.
5. В настройках главной выберите два разных опубликованных проекта. Главная имеет фиксированную структуру; свободного конструктора страницы нет.

Черновики доступны только владельцу. `/api/media/...` проверяет авторизацию либо наличие ссылки в опубликованном кейсе; Nginx не раздаёт рабочую папку медиа напрямую. Снятие публикации удаляет кейс из публичных чтений и SEO-маршрутов. После изменения сервер инвалидирует Next cache; уже открытая вкладка требует обновления.

## Проверки

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
node --test scripts/operations.test.mjs scripts/local-runtime.test.mjs
docker compose -f compose.dev.yaml config --quiet
```

Полная эксплуатационная интеграция (после сборки API): `node scripts/test-backup-restore.mjs --env-file /absolute/path/test.env --output-dir /absolute/path/test-backups`. Она допускает только отдельный Compose project `nepomiluu-infra-check*` или `portfolio-restore-test*` и пустую БД, создаёт синтетические RU/EN кейсы и реальные WebP, проверяет unlock после ошибки backup, успешный dump/restore, исключение сессий и smoke отдельного API. Тестовые данные и отчёт сохраняются для разбора; не используйте production env.

После сборки обоих images можно выполнить `node scripts/test-production.mjs --env-file /absolute/path/test.env --output-dir /absolute/path/production-check`. Требуются тот же отдельный тестовый project с опубликованным кейсом и тестовый TLS-сертификат в `TLS_CERT_DIR`. Override `deploy/compose.verify.yaml` убирает все порты хоста; запросы идут из API-контейнера к Nginx внутри Docker. Проверяются RU/EN, опубликованные и скрытые кейсы, runtime SEO URL, standalone static/public файлы, HTTPS redirect и авторизация медиа. Самоподписанный сертификат принимается только этим тестовым клиентом; проверка доверия цепочке CA в smoke не выполняется. Отчёт содержит фактические image ID, данные и контейнеры сохраняются для разбора.

Браузерные тесты требуют доступных web/API/Mongo и установленного Chromium Playwright. Успешный build сам по себе не подтверждает визуальное совпадение с макетами, защиту preview или восстановление backup. Результаты фактически запущенных проверок фиксируются в журнале реализации.

## Production на Linux

Нужны Docker Engine, Compose v2.24.4+, Node 24 для эксплуатационных скриптов и системный `tar`. Один API-процесс и standalone MongoDB — сознательное ограничение: не масштабируйте API репликами без замены механизма блокировки. Наружу открыты только Nginx 80/443; Mongo и API не публикуют порты хоста. Медиа и БД имеют разные persistent volumes.

1. Скопируйте `.env.example` в **`/etc/nepomiluu/portfolio.env` вне репозитория**, установите права `600` и заполните значения. `INTERNAL_SECRET` — случайная строка не короче 32 символов. Отдельно задайте случайный `MONGO_ROOT_PASSWORD` и соответствующий URL-кодированный пароль в `MONGODB_URI`.
2. Укажите `DOMAIN=ваш.домен`, `PUBLIC_ORIGIN=https://ваш.домен`, `MONGO_DB=portfolio`, `MONGODB_URI=mongodb://portfolio_root:URL_ENCODED_PASSWORD@mongo:27017/portfolio?authSource=admin`. Все placeholder-значения замените. `APP_VERSION` — уникальная версия релиза, например дата и короткий Git SHA.
3. Сертификат выпускается внешним ACME-клиентом. Смонтируйте каталог с действительными `fullchain.pem` и `privkey.pem` через `TLS_CERT_DIR` (по умолчанию `/etc/nepomiluu/tls`). Ссылки Certbot из `live/` могут вести за пределы mount: обновляйте отдельные файлы в этом каталоге через renewal hook либо смонтируйте всю цепочку с разрешаемыми внутри контейнера путями. Ключ не копируется в Docker image.
4. Соберите и запустите:

```bash
docker compose --env-file /etc/nepomiluu/portfolio.env config --quiet
docker compose --env-file /etc/nepomiluu/portfolio.env build --pull
docker compose --env-file /etc/nepomiluu/portfolio.env up -d --wait
docker compose --env-file /etc/nepomiluu/portfolio.env ps
```

Не публикуйте вывод `docker compose config`: он содержит секреты. Dockerfiles используют Node 24, pnpm 10.20.0, `--frozen-lockfile`, отдельные build/runtime стадии. Next standalone содержит `public` и `.next/static`; API runtime содержит только production зависимости, собранный API и операционные скрипты. Изменения lockfile должны проверяться до сборки, не внутри deployment.

Для первичного HTTP-подъёма без сертификата:

```bash
docker compose --env-file /etc/nepomiluu/portfolio.env -f compose.yaml -f deploy/compose.http.yaml up -d --build --wait
```

По умолчанию override слушает loopback; `.env` может явно разрешить `HTTP_BIND=0.0.0.0` и порт 80. Это временный bootstrap: CMS и её API возвращают 503 до включения HTTPS, `PUBLIC_ORIGIN` остаётся HTTPS. Сертификат он сам не выпускает: используйте внешний DNS-01 либо временно остановите Nginx для standalone HTTP-01 ACME-клиента. Для перехода на TLS выполните обычный `up -d --wait` без override, чтобы пересоздать Nginx. После обновления сертификата выполните `docker compose ... exec nginx nginx -s reload`.

Healthchecks проверяют Mongo, API, web и Nginx; Docker logs ограничены тремя файлами по 10 MiB на контейнер. Проверяйте `docker compose ... logs --tail 100 api web nginx`, не копируя секреты в отчёты. На сервере настройте уведомление о ненулевом коде backup и о нездоровых контейнерах; доставка уведомлений в этот репозиторий не включена.

## Backup: ежедневно, семь архивов

```bash
node /opt/nepomiluu/scripts/backup.mjs --env-file /etc/nepomiluu/portfolio.env --output-dir /var/backups/nepomiluu
```

Запускать от оператора с доступом к Docker; каталог backup находится **вне рабочего media volume**. Нельзя запускать CLI seed/сброс владельца параллельно с backup.

Скрипт получает внутреннюю блокировку с lease до 900 секунд, дожидается активных изменений, делает `mongodump --archive --gzip` без временной коллекции `sessions`, копирует медиа и проверяет ссылки обоих языков. Незавершённые upload-папки и файл блокировки в архив не попадают. После захвата согласованного снимка блокировка снимается в `finally`; при аварии lease ограничивает время запрета записей. Если lease потерян или истёк, готовый архив не создаётся. Сжатие выполняется уже после снятия блокировки.

Bundle содержит дамп, media, инвентаризацию и `manifest.json`: время, версии Node/Mongo/FCV/приложения, фактические image ID, размеры и SHA-256 каждого файла. Если images меняются во время захвата, backup прерывается. Готовый `.tar.gz` появляется через атомарное переименование; затем сохраняются семь последних успешно завершённых архивов. Ошибка не создаёт готовый bundle и не запускает retention. Хеши обнаруживают повреждение; криптографическая подпись архивов не предусмотрена.

Пример `/etc/cron.d/nepomiluu-backup` (путь `node` проверьте на сервере):

```cron
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
15 3 * * * root /usr/bin/flock -n /run/lock/nepomiluu-backup.lock /usr/bin/node /opt/nepomiluu/scripts/backup.mjs --env-file /etc/nepomiluu/portfolio.env --output-dir /var/backups/nepomiluu >> /var/log/nepomiluu-backup.log 2>&1
```

Лог cron включите в системный logrotate. Копии локальные: потеря сервера или диска может уничтожить и сайт, и backup. Перенос на другой носитель/сервер — отдельная эксплуатационная задача, в этой версии внешнее хранилище не подключено.

## Проверенное восстановление в изоляции

```bash
node /opt/nepomiluu/scripts/restore.mjs --env-file /etc/nepomiluu/portfolio.env --bundle /var/backups/nepomiluu/portfolio-ДАТА_ID.tar.gz --restore-root /var/backups/nepomiluu/restore-checks --smoke
```

По умолчанию создаются **новая** БД `portfolio_restore_*` в той же Mongo и новая папка медиа. Скрипт не принимает имя рабочей базы, не применяет `--drop`, отказывается от существующей БД/папки, проверяет безопасные пути архива и SHA-256 перед импортом. Импорт ограничен namespace исходной БД и исключает сессии. Проверяются одинаковые major MongoDB и FCV; при обновлении major сначала проверяйте процедуру на копии.

После импорта сравнивается содержимое БД с инвентаризацией backup, проверяются все ссылки `draft` и `publishedSnapshot`, пары RU/EN, опубликованные слоты главной и три варианта каждого сохранённого медиа. `--smoke` дополнительно запускает отдельный API с восстановленной БД и read-only медиа: health, публичные кейсы, доступность трёх вариантов публичных изображений и 404 для частных медиа без сессии. Итог записывается в `verification.json`. Для полного визуального сравнения запустите отдельный web/API с новым `MONGODB_URI`, новым media mount и отдельным доменом/портом; рабочий сайт скрипт не переключает.

Восстановленная БД и папка намеренно сохраняются для проверки. Даже при ошибке частично восстановленная изолированная БД не удаляется автоматически: исправьте причину и повторите с новым именем. Переключение на проверенные данные выполняется отдельно в maintenance window: остановите записи, сделайте свежий backup, укажите проверенные Mongo URI/media mount и пересоздайте API. Сессии в дамп не входят — владелец войдёт повторно.

## Обновление и откат

Перед обновлением: успешный backup и пробное `restore --smoke`, сохранённый внешний env и предыдущие локальные images `nepomiluu-api:VERSION` / `nepomiluu-web:VERSION`. Задайте новый уникальный `APP_VERSION`, выполните build, затем `up -d --wait`; проверьте RU/EN, вход, preview и публикацию. Сборка не меняет рабочие volumes.

Для отката кода верните прежний `APP_VERSION` и выполните `up -d --no-build --wait`, пока прежние images сохранены. Такой откат требует совместимого формата БД. Не запускайте `down -v` и не удаляйте volumes. Если данные несовместимы, используйте сначала изолированную процедуру восстановления; автоматического разрушительного отката данных нет.

## Официальные технические ориентиры

- [Node.js LTS](https://nodejs.org/en/download) и [закреплённые official images](https://github.com/docker-library/official-images/tree/master/library).
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output): `public` и `.next/static` копируются отдельно.
- [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) и [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/): на standalone согласованность достигается паузой прикладных записей, а не `--oplog`.
