import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sharp = createRequire(join(root, 'apps/api/package.json'))('sharp');
const checkOnly = process.argv.includes('--check');
const publicDir = join(root, 'apps/web/public');
const iconSource = 'apps/web/src/app/icon.svg';
const manifestPath = join(root, 'docs/social-assets-manifest.json');
const previous = checkOnly ? JSON.parse(await readFile(manifestPath, 'utf8')) : null;
const files = [];
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const jpeg = { quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true };
const images = [
  ['assets/originals/social/portfolio-ru-v1.png', 'social/portfolio-ru-v1.jpg', 'cover'],
  ['assets/originals/social/portfolio-en-v1.png', 'social/portfolio-en-v1.jpg', 'cover'],
  ['design/clypse-portfolio/01-cover.png', 'social/clypse-cover-v1.jpg', 'contain'],
  ['design/fomin-clinic-portolio/01-cover.png', 'social/fomina-cover-v1.jpg', 'contain'],
];
await mkdir(join(publicDir, 'social'), { recursive: true });

async function record(source, output, bytes, format, width, height) {
  const sourceBytes = await readFile(join(root, source));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, format, output);
  assert.equal(metadata.width, width, output);
  assert.equal(metadata.height, height, output);
  assert.ok(bytes.length < 1_000_000, `${output}: size budget`);
  const entry = { source, output: `apps/web/public/${output}`, width, height, format, bytes: bytes.length, sourceSha256: hash(sourceBytes), sha256: hash(bytes) };
  if (previous) assert.deepEqual(entry, previous.files.find(file => file.output === entry.output), `Changed asset: ${output}`);
  files.push(entry);
  console.log(`${output}: ${width} x ${height}, ${bytes.length} bytes; verified`);
}

for (const [source, output, fit] of images) {
  if (!checkOnly) await sharp(join(root, source)).resize(1200, 630, { fit, background: '#f8f5ef' }).toColourspace('srgb').jpeg(jpeg).toFile(join(publicDir, output));
  await record(source, output, await readFile(join(publicDir, output)), 'jpeg', 1200, 630);
}

for (const [output, size] of [['icon-32.png', 32], ['icon-48.png', 48], ['apple-touch-icon.png', 180]]) {
  if (!checkOnly) await sharp(join(root, iconSource)).resize(size, size).png().toFile(join(publicDir, output));
  await record(iconSource, output, await readFile(join(publicDir, output)), 'png', size, size);
}

// A single PNG-compressed 32px ICO entry; no additional image dependency needed.
const png = await readFile(join(publicDir, 'icon-32.png'));
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
const ico = Buffer.concat([header, png]);
if (checkOnly) assert.deepEqual(await readFile(join(publicDir, 'favicon.ico')), ico, 'Invalid ICO');
else await writeFile(join(publicDir, 'favicon.ico'), ico);

if (!checkOnly) await writeFile(manifestPath, JSON.stringify({ tool: `sharp ${sharp.versions.sharp}`, jpeg, geometry: '1200x630. Home artwork resized with at most a subpixel edge crop; case presentation boards fit in full with ivory side margins. No UI content or portraits edited.', files }, null, 2) + '\n');
console.log('Social images, brand icons and ICO verified.');
