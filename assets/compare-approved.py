"""Build QA overlays only; preserve all design and application source images."""
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent.parent
captures = root / 'output/visual/final-desktop'
output = captures / 'overlays'
output.mkdir(exist_ok=True)
sections = [
    ('01-hero.png', 'hero'), ('02-clypse-case.png', 'clypse'),
    ('03-fomina-case.png', 'fomina'), ('04-logic-and-feeling.png', 'logic'),
    ('05-experience.png', 'experience'), ('06-how-we-work.png', 'process'),
    ('07-footer.png', 'footer'),
]
lines = ['# Контрольные кадры и наложения', '',
         'Normal motion, RU, 1586 × 992 CSS px. Слева исходные PNG; справа настоящие браузерные снимки. '
         'Наложения предназначены для визуального разбора, а не для автоматического утверждения попиксельного совпадения.', '',
         '| Раздел | Макет | Браузер | Наложение 50% |', '| --- | --- | --- | --- |']
for reference_name, name in sections:
    reference = Image.open(root / 'design' / reference_name).convert('RGB')
    capture = Image.open(captures / f'{name}.png').convert('RGB')
    if name == 'process' and reference.size == (1585, 992) and capture.size == (1586, 992):
        capture = capture.crop((0, 0, 1585, 992))
    if reference.size != capture.size:
        raise ValueError(f'{name}: size mismatch {reference.size} / {capture.size}')
    Image.blend(reference, capture, .5).save(output / f'{name}.png')
    ImageChops.difference(reference, capture).save(output / f'{name}-difference.png')
    lines.append(f'| {name} | [PNG](../../../design/{reference_name}) | [PNG]({name}.png) | [PNG](overlays/{name}.png) |')
lines += ['', 'У шестого исходника ширина 1585 px: для наложения удалён только последний правый столбец браузерного кадра. '
          'Оригинальный снимок сохранён целиком. Ни одна картинка не масштабировалась.', '',
          'Ограничения: реальные экраны Clypse ещё не предоставлены; Фомина использует настоящий сайт, '
          'портрет — исходную фотографию. Эти области отличаются от сгенерированных концепций намеренно. '
          'Подробности — [визуальный отчёт](../../../docs/visual-fidelity.md).']
(captures / 'README.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'{len(sections)} overlays: {output}')
