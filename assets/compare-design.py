"""Reference overlays for visual QA; never modifies application images."""
from pathlib import Path
import argparse
from PIL import Image, ImageChops

parser = argparse.ArgumentParser()
parser.add_argument('reference')
parser.add_argument('capture')
parser.add_argument('output')
args = parser.parse_args()
reference = Image.open(args.reference).convert('RGB')
capture = Image.open(args.capture).convert('RGB')
if reference.size != capture.size:
    raise SystemExit(f'Size mismatch: {reference.size} vs {capture.size}')
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
Image.blend(reference, capture, 0.5).save(output)
ImageChops.difference(reference, capture).save(output.with_stem(output.stem + '-difference'))
print(output)
