import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { collectMedia, type Media, type ProjectContent } from '@portfolio/contracts';
import { CONFIG, type ApiConfig } from './config.js';
import { Database, type MediaRow } from './database.js';
export const MAX_UPLOAD = 20 * 1024 * 1024;
export const BUILTIN_MEDIA = new Set([
  'builtin:fomina-home', 'builtin:fomina-doctors', 'builtin:fomina-service',
  'builtin:clypse-cover', 'builtin:clypse-forms', 'builtin:clypse-documents', 'builtin:clypse-design-language',
  'builtin:fomina-cover', 'builtin:fomina-doctors-board', 'builtin:fomina-specialist', 'builtin:fomina-design-language',
]);
export const VARIANTS = ['thumb', 'page', 'full'] as const;
const widths = { thumb: 480, page: 1600, full: 2560 };
export function mediaDto(row: MediaRow): Media { return { id: row._id, width: row.width, height: row.height, mime: row.mime, bytes: row.bytes, hash: row.hash, originalName: row.originalName, createdAt: row.createdAt.toISOString(), url: `/api/media/${row._id}/page` }; }
@Injectable()
export class MediaService {
  constructor(@Inject(Database) private readonly db: Database, @Inject(CONFIG) private readonly config: ApiConfig) {}
  async list() { return (await this.db.media.find().sort({ createdAt: -1 }).limit(500).lean()).map(mediaDto); }
  async verifyReferences(content: ProjectContent) {
    const ids = [...new Set(collectMedia(content).map(image => image.mediaId))];
    const stored = await this.db.media.find({ _id: { $in: ids.filter(id => !id.startsWith('builtin:')) } }).select('_id').lean();
    const known = new Set(stored.map(item => item._id));
    const missing = ids.filter(id => !BUILTIN_MEDIA.has(id) && !known.has(id));
    for (const id of ids.filter(value => BUILTIN_MEDIA.has(value))) {
      try { await access(join(this.config.publicAssetsDir, `${id.slice(8)}.webp`)); }
      catch { missing.push(id); }
    }
    for (const id of known) {
      try { await Promise.all(VARIANTS.map(variant => access(join(this.config.mediaDir, id, `${variant}.webp`)))); }
      catch { missing.push(id); }
    }
    if (missing.length) throw new BadRequestException({ message: 'Content references missing media', errors: missing });
  }
  async publicReference(id: string) {
    const projects = await this.db.projects.find({ publishedSnapshot: { $ne: null } }).select('publishedSnapshot').lean();
    return projects.some(project => project.publishedSnapshot && collectMedia(project.publishedSnapshot).some(image => image.mediaId === id));
  }
  async file(id: string, variant: string, authenticated: boolean) {
    if (!/^[a-f0-9-]{36}$/.test(id) || !VARIANTS.includes(variant as typeof VARIANTS[number])) throw new NotFoundException('Media not found');
    if (!authenticated && !await this.publicReference(id)) throw new NotFoundException('Media not found');
    if (!await this.db.media.exists({ _id: id })) throw new NotFoundException('Media not found');
    return join(this.config.mediaDir, id, `${variant}.webp`);
  }
  async upload(file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an image file');
    if (file.size > MAX_UPLOAD) throw new BadRequestException('Image exceeds 20 MiB');
    let metadata: sharp.Metadata;
    try { metadata = await sharp(file.buffer, { limitInputPixels: 40_000_000, animated: false }).metadata(); } catch { throw new BadRequestException('Invalid or oversized image'); }
    const acceptedFormat = ['jpeg', 'png', 'webp', 'avif'].includes(metadata.format || '') || (metadata.format === 'heif' && metadata.compression === 'av1');
    if (!acceptedFormat || !metadata.width || !metadata.height || (metadata.pages || 1) > 1) throw new BadRequestException('Only static JPEG, PNG, WebP or AVIF images are accepted');
    const id = randomUUID();
    await mkdir(this.config.mediaDir, { recursive: true });
    const temporary = join(this.config.mediaDir, `.upload-${id}`);
    const destination = join(this.config.mediaDir, id);
    await mkdir(temporary);
    try {
      const output = await Promise.all(VARIANTS.map(async variant => {
        const { data, info } = await sharp(file.buffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width: widths[variant], withoutEnlargement: true }).webp({ quality: variant === 'full' ? 88 : 82 }).toBuffer({ resolveWithObject: true });
        await writeFile(join(temporary, `${variant}.webp`), data, { flag: 'wx', mode: 0o600 });
        return { variant, info, size: data.length };
      }));
      await rename(temporary, destination);
      const full = output.find(item => item.variant === 'full')!;
      const originalName = [...file.originalname.replace(/.*[\\/]/, '')].filter(character => character.charCodeAt(0) >= 32).join('').slice(0, 200);
      const row = await this.db.media.create({ _id: id, width: full.info.width, height: full.info.height, mime: 'image/webp', bytes: full.size, hash: createHash('sha256').update(file.buffer).digest('hex'), originalName, createdAt: new Date() });
      return mediaDto(row.toObject());
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      // An ambiguous database error may still have committed the record. Keep
      // finalized immutable files rather than risk leaving a dangling record.
      if ((error as Error).name === 'Error') throw new BadRequestException('Image could not be decoded or stored');
      throw error;
    }
  }
}
