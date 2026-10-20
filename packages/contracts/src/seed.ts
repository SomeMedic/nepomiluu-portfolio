import type { ImageRef, Localized, ProjectContent } from './index';

const l = (ru: string, en: string): Localized => ({ ru, en });
const image = (name: string, ru: string, en: string): ImageRef => ({ mediaId: `builtin:${name}`, alt: l(ru, en) });

const clypseCover = image(
  'clypse-cover',
  'Презентация Clypse: библиотека форм и редактор документа в едином рабочем пространстве',
  'Clypse presentation: the form library and document editor within one workspace',
);
const clypseForms = image(
  'clypse-forms',
  'Редактор формы Clypse с полями брифа, вкладками ответов и аналитики, предпросмотром и публикацией',
  'The Clypse form builder with brief fields, responses and analytics tabs, preview and publishing controls',
);
const clypseDocuments = image(
  'clypse-documents',
  'Редактор документа Clypse: текст, навигация по материалам и боковая панель структуры и инструментов',
  'The Clypse document editor: content, material navigation and a sidebar with structure and tools',
);
const clypseDesignLanguage = image(
  'clypse-design-language',
  'Визуальная система Clypse: библиотека форм, центр обучения, редактор, палитра и типографика',
  'The Clypse visual system: form library, learning centre, editor, colour palette and typography',
);
const fominaCover = image(
  'fomina-cover',
  'Презентация сайта клиники Фомина с главным экраном, навигацией и кнопкой записи',
  'A presentation of the Fomin Clinic website with its homepage, navigation and booking action',
);
const fominaDoctors = image(
  'fomina-doctors-board',
  'Каталог врачей клиники Фомина: поиск, фильтры и карточки специалистов с данными о приёме',
  'The Fomin Clinic doctor directory: search, filters and specialist cards with appointment details',
);
const fominaSpecialist = image(
  'fomina-specialist',
  'Страница специалиста клиники Фомина с фотографией, опытом, услугами и переходом к расписанию',
  'A Fomin Clinic specialist profile with a photo, experience, services and access to the appointment schedule',
);
const fominaDesignLanguage = image(
  'fomina-design-language',
  'Визуальная система сайта клиники Фомина: розовые и сиреневые оттенки, типографика, карточки и кнопки',
  'The Fomin Clinic website visual system: pink and lilac colours, typography, cards and buttons',
);

export const seedProjects: Array<{ slug: string; draft: ProjectContent; publish?: boolean }> = [
  {
    slug: 'clypse',
    publish: true,
    draft: {
      title: l('Clypse — от действия к системе', 'Clypse — from an action to a system'),
      summary: l('AI-native workspace для заметок, документов, файлов и медиа. Сценарии MVP, экраны и компоненты — в команде из трёх человек.', 'An AI-native workspace for notes, documents, files and media. MVP flows, screens and components designed within a team of three.'),
      category: l('B2C SaaS · продуктовый дизайн', 'B2C SaaS · product design'),
      role: l('UX/UI & Product Designer · ключевой участник команды', 'UX/UI & Product Designer · core team member'),
      period: l('Июнь 2025 — сентябрь 2026', 'June 2025 — September 2026'),
      status: l('По резюме: интерфейсы реализованы, публичный запуск впереди', 'As recorded in the CV: interfaces implemented, public launch pending'),
      seoTitle: l('Clypse — кейс Ульяны Непомилуевой', 'Clypse — a case study by Uliana Nepomilueva'),
      seoDescription: l('Продуктовый дизайн Clypse: единое рабочее пространство, конструктор форм, редактор документов и визуальная система.', 'Product design for Clypse: a shared workspace, form builder, document editor and visual system.'),
      cover: clypseCover,
      home: {
        headline: l('От действия — к системе.', 'From an action to a system.'),
        subline: l('Clypse · AI-native workspace', 'Clypse · AI-native workspace'),
        stages: [
          {
            label: l('01 / Контекст', '01 / Context'),
            title: l('Разные задачи. Одна среда.', 'Different tasks. One workspace.'),
            body: l('Заметки, документы и формы связаны общей навигацией.', 'Notes, documents and forms share a common navigation.'),
            image: clypseCover,
            annotations: [],
          },
          {
            label: l('02 / Сценарий', '02 / Flow'),
            title: l('От полей — к ответам.', 'From fields to responses.'),
            body: l('Собрать форму, проверить и опубликовать — в одном редакторе.', 'Build, preview and publish a form from the same editor.'),
            image: clypseForms,
            annotations: [],
          },
          {
            label: l('03 / Решение', '03 / Solution'),
            title: l('Общий язык продукта.', 'A shared product language.'),
            body: l('Типографика, компоненты и ритм связывают разные инструменты.', 'Typography, components and rhythm connect the tools.'),
            image: clypseDesignLanguage,
            annotations: [],
          },
        ],
      },
      blocks: [
        {
          id: 'context',
          type: 'text',
          title: l('Рабочая среда для разных задач', 'A workspace for different tasks'),
          body: l(
            'В Clypse я проектировала сценарии MVP, экраны и состояния интерфейса: от управления контентом до онбординга и настроек. В команде нас было трое.\n\nКейс собран по резюме и предоставленным презентационным материалам проекта.',
            'At Clypse, I designed MVP flows, screens and interface states, from content management to onboarding and settings. We worked as a team of three.\n\nThis case brings together the CV and the supplied project presentation boards.',
          ),
        },
        {
          id: 'workspace',
          type: 'image',
          image: clypseCover,
          caption: l('Библиотека объединяет разные типы контента, а боковая навигация сохраняет общий контекст работы.', 'The library brings different content types together, while the sidebar keeps the workspace context in view.'),
        },
        {
          id: 'forms',
          type: 'image',
          image: clypseForms,
          caption: l('В конструкторе рядом с полями находятся предпросмотр и публикация. Ответы и аналитика вынесены в отдельные вкладки.', 'Preview and publishing sit alongside the form fields. Responses and analytics have their own tabs.'),
        },
        {
          id: 'documents',
          type: 'image',
          image: clypseDocuments,
          caption: l('Текст остаётся в центре редактора. Структура документа, его состояние и дополнительные инструменты собраны в боковой панели.', 'The text stays at the centre of the editor. Document structure, status and supporting tools sit in a sidebar.'),
        },
        {
          id: 'system',
          type: 'text',
          title: l('Связать экраны между собой', 'Connecting the screens'),
          body: l('В мой объём работы входили компоненты, дизайн-система и адаптивные версии. Общая навигация, спокойная палитра и повторяющиеся элементы связывают библиотеку, формы и редактор в один продукт.', 'My scope included components, the design system and responsive layouts. Shared navigation, a restrained palette and recurring elements connect the library, forms and editor as one product.'),
        },
        {
          id: 'design-language',
          type: 'image',
          image: clypseDesignLanguage,
          caption: l('Одна визуальная система для библиотеки, редактора и обучающих материалов.', 'One visual system across the library, editor and learning materials.'),
        },
        {
          id: 'delivery',
          type: 'text',
          title: l('Стадия проекта', 'Project stage'),
          body: l('По резюме, спроектированные интерфейсы реализованы. На момент его подготовки публичный запуск Clypse ещё не состоялся.', 'According to the CV, the designed interfaces were implemented. Clypse had not publicly launched when the CV was prepared.'),
        },
      ],
    },
  },
  {
    slug: 'fomina',
    publish: true,
    draft: {
      title: l('Клиника Фомина — внимание в каждой детали', 'Fomin Clinic — care in every detail'),
      summary: l('Дизайн медицинского сайта: от знакомства с клиникой до выбора специалиста и записи на приём.', 'Healthcare website design: from discovering the clinic to choosing a specialist and booking an appointment.'),
      category: l('MedTech · медицинский сайт', 'MedTech · healthcare website'),
      role: l('UX/UI · полный дизайн сайта', 'UX/UI · complete website design'),
      period: l('Дата проекта в резюме не указана', 'Project dates are not specified in the CV'),
      status: l('Дизайн сайта клиники', 'Clinic website design'),
      seoTitle: l('Клиника Фомина — UX/UI кейс Ульяны Непомилуевой', 'Fomin Clinic — UX/UI case study by Uliana Nepomilueva'),
      seoDescription: l('Дизайн сайта клиники Фомина: главная, каталог врачей, страница специалиста и единая визуальная система.', 'Fomin Clinic website design: homepage, doctor directory, specialist profile and a shared visual system.'),
      cover: fominaCover,
      home: {
        headline: l('Внимание. В каждой детали.', 'Care. In every detail.'),
        subline: l('Клиника Фомина · медицинский сайт', 'Fomin Clinic · healthcare website'),
        stages: [
          {
            label: l('01 / Знакомство', '01 / Introduction'),
            title: l('Понятный первый шаг.', 'A clear first step.'),
            body: l('Главная знакомит с клиникой и открывает путь к услугам и врачам.', 'The homepage introduces the clinic and leads to services and doctors.'),
            image: fominaCover,
            annotations: [],
          },
          {
            label: l('02 / Выбор врача', '02 / Find a doctor'),
            title: l('Сузить выбор.', 'Narrow the choice.'),
            body: l('Поиск, фильтры и карточки помогают сравнить специалистов.', 'Search, filters and cards help compare specialists.'),
            image: fominaDoctors,
            annotations: [],
          },
          {
            label: l('03 / Запись', '03 / Appointment'),
            title: l('От деталей — к записи.', 'From details to booking.'),
            body: l('Опыт врача, услуги и переход к расписанию собраны в профиле.', 'Experience, services and access to the schedule come together in the profile.'),
            image: fominaSpecialist,
            annotations: [],
          },
        ],
      },
      blocks: [
        {
          id: 'context',
          type: 'text',
          title: l('Забота начинается с ясности', 'Care starts with clarity'),
          body: l(
            'Полный дизайн сайта медицинской организации — от главной страницы до каталога врачей и профиля специалиста. Здесь моя работа с интерфейсами встретилась с медицинской подготовкой.\n\nКейс собран по резюме и предоставленным презентационным материалам проекта.',
            'Complete design of a healthcare website, from the homepage to the doctor directory and specialist profile. The project brought together my interface work and medical training.\n\nThis case brings together the CV and the supplied project presentation boards.',
          ),
        },
        {
          id: 'homepage',
          type: 'image',
          image: fominaCover,
          caption: l('Первый экран знакомит с клиникой. Услуги, врачи и запись доступны в основной навигации.', 'The opening screen introduces the clinic. Services, doctors and booking are available in the main navigation.'),
        },
        {
          id: 'doctor-choice',
          type: 'text',
          title: l('От общего выбора — к человеку', 'From a broad choice to a person'),
          body: l('Поиск по имени и фильтры по специальности и клинике помогают сузить список. Карточки собирают сведения для следующего шага: опыт врача, место приёма, ближайшую доступность и стоимость.', 'Name search and specialty and clinic filters narrow the list. The cards bring together practical details for the next step: experience, location, next availability and price.'),
        },
        {
          id: 'doctors',
          type: 'image',
          image: fominaDoctors,
          caption: l('Единый порядок информации в карточках позволяет сопоставить специалистов и условия приёма.', 'A consistent information order makes it possible to compare specialists and appointment details.'),
        },
        {
          id: 'specialist',
          type: 'image',
          image: fominaSpecialist,
          caption: l('Профиль раскрывает опыт и услуги конкретного врача. Рядом остаётся переход к расписанию и записи.', 'The profile gives more detail about a doctor’s experience and services, with access to scheduling and booking close at hand.'),
        },
        {
          id: 'visual-system',
          type: 'text',
          title: l('Спокойная подача, заметное действие', 'A calm layout, a clear next action'),
          body: l('Светлые поверхности, мягкие цветовые поля и крупные фотографии задают характер сайта. Насыщенный акцент выделяет действия, а общие правила типографики, карточек и кнопок связывают страницы.', 'Light surfaces, soft colour fields and large photographs shape the site’s character. A saturated accent highlights actions, while shared typography, cards and buttons connect the pages.'),
        },
        {
          id: 'design-language',
          type: 'image',
          image: fominaDesignLanguage,
          caption: l('Палитра, типографика и компоненты — от главной страницы до карточки врача.', 'Palette, typography and components, from the homepage to an individual doctor card.'),
        },
      ],
    },
  },
];
