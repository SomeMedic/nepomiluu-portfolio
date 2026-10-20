import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const requireApi = createRequire(join(root, 'apps/api/package.json'));
const sharp = requireApi('sharp');
const checkOnly = process.argv.includes('--check');
const outputDirectory = join(root, 'apps/web/public/assets');
const manifestPath = join(root, 'docs/project-boards-manifest.json');
const settings = { quality: 94, effort: 6, smartSubsample: true };
const sources = [
  ['clypse-cover', 'design/clypse-portfolio/01-cover.png'],
  ['clypse-forms', 'design/clypse-portfolio/02-forms.png'],
  ['clypse-documents', 'design/clypse-portfolio/03-documents.png'],
  ['clypse-design-language', 'design/clypse-portfolio/04-design-language.png'],
  ['fomina-cover', 'design/fomin-clinic-portolio/01-cover.png'],
  ['fomina-doctors-board', 'design/fomin-clinic-portolio/02-doctors.png'],
  ['fomina-specialist', 'design/fomin-clinic-portolio/03-specialist.png'],
  ['fomina-design-language', 'design/fomin-clinic-portolio/04-design-language.png'],
];
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const previousManifest = checkOnly ? JSON.parse(await readFile(manifestPath, 'utf8')) : null;
const files = [];

await mkdir(outputDirectory, { recursive: true });
for (const [name, source] of sources) {
  const sourceBuffer = await readFile(join(root, source));
  const metadata = await sharp(sourceBuffer).metadata();
  assert.equal(metadata.format, 'png', `${source}: expected PNG`);
  assert.equal(metadata.width, 1586, `${source}: unexpected width`);
  assert.equal(metadata.height, 992, `${source}: unexpected height`);
  assert.equal(metadata.space, 'srgb', `${source}: unexpected colour space`);
  const output = `apps/web/public/assets/${name}.webp`;
  if (!checkOnly) {
    // Full frame: no resize, crop, retouching, compositing or colour adjustment.
    await sharp(sourceBuffer).webp(settings).toFile(join(root, output));
  }
  const outputBuffer = await readFile(join(root, output));
  const outputMetadata = await sharp(outputBuffer).metadata();
  assert.equal(outputMetadata.format, 'webp', `${output}: invalid WebP`);
  assert.equal(outputMetadata.width, metadata.width, `${output}: width changed`);
  assert.equal(outputMetadata.height, metadata.height, `${output}: height changed`);
  assert.equal(outputMetadata.space, metadata.space, `${output}: colour space changed`);
  assert.ok(outputBuffer.length < sourceBuffer.length, `${output}: no size reduction`);
  const record = {
    mediaId: `builtin:${name}`,
    source,
    output,
    width: metadata.width,
    height: metadata.height,
    colourSpace: metadata.space,
    sourceBytes: sourceBuffer.length,
    outputBytes: outputBuffer.length,
    sourceSha256: sha256(sourceBuffer),
    outputSha256: sha256(outputBuffer),
    sourceFormat: metadata.format,
    outputFormat: outputMetadata.format,
  };
  if (checkOnly) {
    assert.deepEqual(record, previousManifest.files.find(file => file.mediaId === record.mediaId), `${output}: manifest mismatch`);
  }
  files.push(record);
  console.log(`${record.mediaId}: ${record.width} × ${record.height}, ${record.sourceBytes} → ${record.outputBytes} bytes; verified`);
}

const manifest = {
  provenance: 'User-provided project presentation boards, received in the project design folders on 2026-10-20. These are supplied presentation compositions, not newly captured screenshots of live websites.',
  conversion: {
    tool: 'sharp',
    version: sharp.versions.sharp,
    webp: settings,
    geometry: 'Full original frame, unchanged dimensions; no crop or rescale.',
    colour: 'Original sRGB colour space; no grading, retouching, compositing or explicit colour adjustment. WebP encoding is lossy.',
  },
  files,
};
if (!checkOnly) {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`${checkOnly ? 'Checked' : 'Prepared'} ${files.length} project presentation boards.`);
