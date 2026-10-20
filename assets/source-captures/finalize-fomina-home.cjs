const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

(async () => {
  const captureRoot = __dirname;
  const candidateRoot = path.join(captureRoot, 'home-recapture');
  const projectRoot = path.resolve(captureRoot, '../..');
  const publicFile = path.join(projectRoot, 'apps/web/public/assets/fomina-home.webp');
  await fs.copyFile(path.join(captureRoot, 'fomina-home.png'), path.join(candidateRoot, 'previous-home.png'));
  await fs.copyFile(path.join(captureRoot, 'fomina-home.json'), path.join(candidateRoot, 'previous-home.json'));
  const snapshot = JSON.parse(await fs.readFile(path.join(candidateRoot, 'first-screen-1920x748.json'), 'utf8'));
  if (!snapshot.heading.fullyVisible || snapshot.scrollY !== 0 || snapshot.fonts !== 'loaded' || snapshot.visibleModal) throw new Error('Selected screenshot is not a complete stable first screen');
  await fs.copyFile(path.join(candidateRoot, 'first-screen-1920x748.png'), path.join(captureRoot, 'fomina-home.png'));
  await sharp(path.join(captureRoot, 'fomina-home.png')).webp({ quality: 92 }).toFile(publicFile);
  const png = await fs.readFile(path.join(captureRoot, 'fomina-home.png'));
  const webp = await fs.readFile(publicFile);
  Object.assign(snapshot, {
    sourceFile: 'assets/source-captures/fomina-home.png',
    publicFile: 'apps/web/public/assets/fomina-home.webp',
    captureMethod: 'Google Chrome headless through Playwright; native screenshot, no DOM, text, image or style changes',
    stabilization: 'Inspected the unchanged 1600x1050 composition at approximately 17, 23 and 35 seconds; document/fonts complete and no page errors. Selected screenshot taken after fonts and images loaded, official notices closed and responsive viewport settled.',
    selectionReason: '1920x748 matches the portfolio slot aspect ratio 1468x571. The original 1600x1050 image lost its low-positioned heading when cropped. A 1600x622 viewport also clipped the heading; 1920x748 shows it fully at scrollY 0.',
    imageConversion: { format: 'WebP', quality: 92, resize: false, crop: false, width: 1920, height: 748 },
    sha256: { png: crypto.createHash('sha256').update(png).digest('hex'), webp: crypto.createHash('sha256').update(webp).digest('hex') },
    comparisonFiles: ['assets/source-captures/home-recapture/previous-home.png', 'assets/source-captures/home-recapture/first-screen-1600x622.png', 'assets/source-captures/home-recapture/content-screen.png'],
  });
  await fs.writeFile(path.join(captureRoot, 'fomina-home.json'), JSON.stringify(snapshot, null, 2));
  const manifestFile = path.join(captureRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  const homeIndex = manifest.findIndex(item => item.sourceUrl === 'https://fomin-clinic.ru/');
  if (homeIndex < 0) throw new Error('Original home manifest entry not found');
  manifest[homeIndex] = snapshot;
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ publicFile: snapshot.publicFile, sourceFile: snapshot.sourceFile, capturedAt: snapshot.capturedAt, metadata: await sharp(publicFile).metadata(), hashes: snapshot.sha256 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
