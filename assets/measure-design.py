"""Read-only pixel measurements of approved design references."""
from pathlib import Path
from collections import Counter
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
result = {}
for file in sorted((root / 'design').glob('0*.png')):
    im = Image.open(file).convert('RGB')
    pixels = list(im.getdata())
    # Quantization is for grouping raster texture, never a mutation of the source.
    def hex_color(rgb): return '#%02x%02x%02x' % tuple(rgb)
    colors = Counter(pixels)
    warm = Counter(p for p in pixels if 95 < p[0] < 210 and p[0] > p[1] * 1.3 and p[1] > p[2] * 1.15)
    dark = Counter(p for p in pixels if max(p) < 100)
    samples = {}
    for name, box in {'top_left':(5,5,45,25),'top_right':(1540,5,1580,25),'center_blank':(700,740,780,780),'bottom_left':(5,950,40,985)}.items():
        samples[name] = hex_color(im.crop(box).resize((1,1)).getpixel((0,0)))
    result[file.name] = {'size':im.size,'dominant':[{'hex':hex_color(p),'count':n} for p,n in colors.most_common(8)],'accent':[{'hex':hex_color(p),'count':n} for p,n in warm.most_common(3)],'ink':[{'hex':hex_color(p),'count':n} for p,n in dark.most_common(3)],'samples':samples}
print(json.dumps(result, ensure_ascii=False, indent=2))
