import type { ProjectContent } from '../../packages/contracts/src/index';

export function fixtureContent(ru: string, en: string): ProjectContent {
  const words = (ru: string, en: string) => ({ ru, en });
  const image = { mediaId: 'builtin:fomina-home', alt: words('Экран тестового проекта', 'Test project screen') };
  return {
    title: words(ru, en), summary: words('Проверяем доступность и публикацию интерфейса.', 'Checking interface accessibility and publishing.'),
    category: words('Тестовый интерфейс', 'Test interface'), role: words('Дизайн продукта', 'Product design'), period: words('2026', '2026'), status: words('Тестовый сценарий', 'Test scenario'),
    seoTitle: words(`${ru} — кейс`, `${en} — case study`), seoDescription: words('Описание тестового проекта на русском.', 'Test project description in English.'),
    cover: image, blocks: [{ id: 'fixture-text', type: 'text', title: words('Задача проекта', 'Project challenge'), body: words('Проверить путь от черновика до опубликованного кейса.', 'Verify the path from a draft to a published case study.') }],
    home: { headline: words('Дизайн с вниманием к человеку.', 'Design with people in mind.'), subline: words('Три этапа работы над продуктом.', 'Three stages of product work.'), stages: [0, 1, 2].map(index => ({ label: words(`Этап ${index + 1}`, `Stage ${index + 1}`), title: words(`Решение ${index + 1}`, `Solution ${index + 1}`), body: words('Изучаем задачу и проверяем понятность интерфейса.', 'Explore the challenge and verify the clarity of the interface.'), image, annotations: [] })) },
  };
}
