# Источники файлов сайта

## Портрет и резюме

- `assets/originals/portrait-source.png` — фотография, предоставленная пользователем. Неизменённая копия для сайта: `apps/web/public/assets/portrait-source.png`.
- SHA-256 обеих копий фотографии: `e3db1935dee0d0bc3758d212549b4ef73a38a07ac20fdc5007f81eb5eca22e05`.
- `apps/web/public/Uliana_Nepomilueva_UX_UI_Product_Designer_CV.pdf` — неизменённая копия одноимённого PDF из корня проекта; 404 757 байт.
- SHA-256 исходного и публичного PDF: `a3a405147274280548362213e7a1ac1a56fb34dcb492f087f57d95f507fd3412`.

## Реальные скриншоты клиники Фомина

Все три страницы открыты в Google Chrome через Playwright 19 октября 2026 года. Выбран город Москва, viewport каталога и услуги — **1600 × 1050 CSS px**, главной — **1920 × 748 CSS px**, DPR — **1**, локаль — `ru-RU`. Все ответы страниц — HTTP 200. Снимки сделаны с верхней позиции страницы, без изменения DOM, текста, изображений и стилей сайта.

| Файл сайта | Страница-источник | Время снимка, UTC |
| --- | --- | --- |
| `apps/web/public/assets/fomina-home.webp` | [Главная](https://fomin-clinic.ru/) | 2026-10-19 19:51:18 |
| `apps/web/public/assets/fomina-doctors.webp` | [Врачи](https://fomin-clinic.ru/doctors/) | 2026-10-19 17:34:13 |
| `apps/web/public/assets/fomina-service.webp` | [Гинекология](https://fomin-clinic.ru/services/ginekologiya/) | 2026-10-19 17:34:29 |

Перед первым снимком штатной кнопкой закрыто уведомление об обновлении входа клиники и подтверждена Москва. На странице врачей повторное уведомление также закрыто штатной кнопкой. На странице услуги дополнительные действия не потребовались. Элементы интерфейса, оставшиеся на снимках, принадлежат исходному сайту.

Исходные PNG без потерь: `assets/source-captures/fomina-{home,doctors,service}.png`. Метаданные, заголовки страниц, действия и снимки текстового состояния DOM: соседние JSON и `assets/source-captures/manifest.json`. WebP получены из PNG с качеством 92; размер кадра и содержимое не изменены. Снимки визуально просмотрены: главная, каталог врачей и страница услуги отображаются без перекрывающего модального окна. Это реальные страницы сайта на дату съёмки.

Скрипт повторной съёмки: `assets/capture-fomina.cjs`; он использует установленный локальный Chrome и Playwright/Sharp из рабочего runtime Codex. Пути к этим инструментам в скрипте относятся к текущей Windows-машине.

## Локальные шрифты

Шрифты загружены **19 октября 2026 года** с официального Google Fonts / `fonts.gstatic.com`. Исходный ответ API сохранён в `assets/originals/google-fonts.css`.

- [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond): прямое начертание 500 и 600, курсив 600.
- [Inter](https://fonts.google.com/specimen/Inter): прямое начертание 400 и 500.
- Включены подмножества `cyrillic`, `cyrillic-ext`, `latin`, `latin-ext`. Это 12 уникальных файлов WOFF2; Google Fonts возвращает один и тот же файл для запрошенных прямых начертаний разных весов.
- Локальные объявления `@font-face`: `apps/web/public/fonts/fonts.css` (URL `/fonts/fonts.css`); `font-display: swap`, оригинальные `unicode-range` сохранены.
- `apps/web/public/fonts/manifest.json` содержит соответствия семейств, начертаний, весов, локальных путей и точных URL источников WOFF2.
- Лицензии SIL Open Font License 1.1 включены рядом со шрифтами: `cormorantgaramond-OFL.txt`, `inter-OFL.txt`.
- Официальные тексты лицензий: [Cormorant Garamond OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt), [Inter OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt).

Проверка: сигнатура всех 12 файлов — `wOF2`; Chrome успешно декодировал все 12 через `FontFace.load()` (`status: loaded`). Для повторной загрузки предусмотрен `assets/fetch-fonts.ps1`.

При визуальной калибровке добавлены Prata 400 и Playfair Display 700 Italic. Их локальные WOFF2, официальные источники и лицензии описаны отдельно в [typography-sources.md](../apps/web/public/fonts/typography-sources.md).

## Lossless WebP портрета

Для Hero создан `apps/web/public/assets/portrait-source-lossless.webp` из неизменённого `apps/web/public/assets/portrait-source.png` с помощью установленного Sharp 0.34.5: `sharp(source).webp({ lossless: true, effort: 6 })`. Размер **960 × 1280**, sRGB, 8 бит на канал сохранены. Масштабирование, кадрирование, ретушь и изменение цвета не применялись. Исходный PNG сохранён.

- PNG: **1 389 683 байта**; WebP: **721 124 байта**. Экономия: **668 559 байт (48,11%)**.
- SHA-256 PNG: `e3db1935dee0d0bc3758d212549b4ef73a38a07ac20fdc5007f81eb5eca22e05`.
- SHA-256 WebP: `7ee0f9c5cd2bd663bdc9ccb97af163aee5da86829e3f9ec2277acafcb1eb01ed`.
- Оба файла независимо декодированы Sharp через `ensureAlpha().raw().toBuffer({ resolveWithObject: true })`. Размеры, параметры RGBA и все **4 915 200 байт** совпали: `Buffer.equals(...) === true`.
- SHA-256 декодированных RGBA обоих файлов: `3b7ff75d0b3957c2892116f1c9c0eb28417f76c438799e735822451b04b7b19e`.

Проверка подтверждает точное совпадение декодированных пикселей, включая лицо и фон исходника. Масштаб, положение и отделение фона задаются отдельно в CSS.

## Уточнение маски портрета — 20.10.2026

Для доработки волос и контура создана отдельная чёрно-белая техническая маска средствами imagegen. Сгенерированные цветные пиксели портрета не используются. В браузере по-прежнему показан исходный lossless WebP фотографии.

- `apps/web/public/assets/portrait-matte-source.png` — техническая чёрно-белая маска; результат генерации `exec-1815d3ac-7f6f-43e2-aef2-64e4fb75d0dd.png`.
- `portrait-mask-refined.png` — яркость технической маски, приведённой к 960 × 1280, перенесена в альфа-канал с помощью Sharp; цветовые каналы белые.
- `portrait-mask-refined.webp` — lossless-версия маски, **242 902 байта**. Альфа-каналы PNG и WebP независимо декодированы и полностью совпали.
- `Hero.module.css` использует маску фона внутри капсулы. Отдельное затухание края одежды убрано по последнему уточнению композиции; лицо не ретушируется, цветокоррекция фотографии не применяется.

Повторная проверка исходной фотографии и lossless WebP после изменения маски: `sourcePhotoPixelsEqual: true`. Маска является отдельным оформительским материалом, а не новой фотографией.

### Волосы за серьгой — точечная правка 20.10.2026

В исходной маске волосы внутри кольца серьги и сразу под ним ошибочно считались фоном. Встроенный **imagegen** использован только для исправления технической маски. Финальная инструкция: «Fill the entire black crescent inside and directly below the hoop with opaque white; preserve all other silhouette details and registration». Результат сохранён в `assets/originals/portrait-matte-earring-correction.png` (генерация `exec-3fdcd74b-c39f-46f1-b48c-c805408a8974.png`).

В рабочую маску перенесён только участок **x=310, y=540, 80 × 134 px** в координатах исходного фото 960 × 1280. Альфа увеличена по исправленной маске; 9709 значений изменились внутри участка, **ни одного снаружи**. Обе рабочие версии обновлены: `apps/web/public/assets/portrait-mask-refined.png` и `.webp` (теперь 237750 байт). Исходная фотография, её lossless WebP, контур остальных волос и форма капсулы сохранены.

Проверка: `node assets/verify-portrait.cjs` сверяет исходные пиксели фотографии, совпадение PNG/WebP альфа-каналов и непрозрачность волос в четырёх точках у серьги. Крупный план и снимки браузера Full HD, WQHD и мобильного размера сохранены локально в `output/verification/portrait-earring`.

## Материалы двух проектов, предоставленные пользователем — 20.10.2026

В `design/clypse-portfolio` и `design/fomin-clinic-portolio` пользователь предоставил восемь готовых презентационных композиций. Они содержат экраны интерфейсов вместе с заголовками и оформлением кейса. Это пользовательские материалы проектов, а не новая съёмка работающих сайтов. Дата выше относится к получению файлов в проекте и не устанавливает дату создания дизайна или запуска продукта.

Все исходные PNG сохранены. Для сайта изготовлены полноразмерные WebP **1586 × 992**, sRGB, Sharp 0.34.5, качество **94**, `effort: 6`, `smartSubsample: true`. Кадрирование, масштабирование, цветокоррекция, дорисовка и ретушь не применяются. WebP использует сжатие с потерями, поэтому побайтовое совпадение пикселей с PNG не заявляется.

| Исходный файл | Файл сайта / builtin media |
| --- | --- |
| `design/clypse-portfolio/01-cover.png` | `clypse-cover.webp` / `builtin:clypse-cover` |
| `design/clypse-portfolio/02-forms.png` | `clypse-forms.webp` / `builtin:clypse-forms` |
| `design/clypse-portfolio/03-documents.png` | `clypse-documents.webp` / `builtin:clypse-documents` |
| `design/clypse-portfolio/04-design-language.png` | `clypse-design-language.webp` / `builtin:clypse-design-language` |
| `design/fomin-clinic-portolio/01-cover.png` | `fomina-cover.webp` / `builtin:fomina-cover` |
| `design/fomin-clinic-portolio/02-doctors.png` | `fomina-doctors-board.webp` / `builtin:fomina-doctors-board` |
| `design/fomin-clinic-portolio/03-specialist.png` | `fomina-specialist.webp` / `builtin:fomina-specialist` |
| `design/fomin-clinic-portolio/04-design-language.png` | `fomina-design-language.webp` / `builtin:fomina-design-language` |

Публичные файлы находятся в `apps/web/public/assets/`. Ранее снятые `fomina-home.webp`, `fomina-doctors.webp`, `fomina-service.webp` сохранены под прежними именами. Новые материалы внесены в разрешённый набор встроенных медиа API.

В [project-boards-manifest.json](project-boards-manifest.json) записаны точные размеры, форматы, SHA-256 исходников и WebP, параметры преобразования и происхождение. Повторное создание: `node scripts/prepare-project-boards.mjs`; независимая проверка сохранённых файлов и манифеста без перекодирования: `node scripts/prepare-project-boards.mjs --check`.
