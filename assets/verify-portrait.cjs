const sharp = require('../apps/api/node_modules/sharp');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '../apps/web/public/assets');
  const photo = file => sharp(path.join(root, file)).ensureAlpha().raw().toBuffer();
  const alpha = file => sharp(path.join(root, file)).extractChannel('alpha').raw().toBuffer();
  const [original, lossless, pngAlpha, webpAlpha] = await Promise.all([
    photo('portrait-source.png'), photo('portrait-source-lossless.webp'),
    alpha('portrait-mask-refined.png'), alpha('portrait-mask-refined.webp'),
  ]);
  const result = { sourcePhotoPixelsEqual: original.equals(lossless), photoBytesCompared: original.length, maskAlphaEqual: pngAlpha.equals(webpAlpha), maskAlphaBytesCompared: pngAlpha.length };
  const output = path.resolve(__dirname, '../output/verification/editorial-refinement/portrait.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.sourcePhotoPixelsEqual || !result.maskAlphaEqual) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
