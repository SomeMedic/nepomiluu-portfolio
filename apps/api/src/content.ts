import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createProjectSchema, homeSelectionSchema, publicationErrors, saveProjectSchema, type HomeResponse, type HomeSelection, type Project, type ProjectContent, type PublishedProject } from '@portfolio/contracts';
import type { ZodType } from 'zod';
import { Database, type ProjectRow } from './database.js';
import { MutationGate } from './mutation-gate.js';
import { MediaService } from './media.js';
import { Revalidation } from './revalidation.js';
export function validate<T>(schema: ZodType<T>, input: unknown): T { const parsed = schema.safeParse(input); if (!parsed.success) throw new BadRequestException({ message: 'Validation failed', errors: parsed.error.flatten() }); return parsed.data; }
export function projectDto(row: ProjectRow): Project { return { id: row._id, slug: row.slug, revision: row.revision, draft: row.draft, publishedSnapshot: row.publishedSnapshot, firstPublishedAt: row.firstPublishedAt?.toISOString() || null, publishedAt: row.publishedAt?.toISOString() || null, updatedAt: row.updatedAt.toISOString() }; }
export function publishedDto(row: ProjectRow): PublishedProject { if (!row.publishedSnapshot || !row.publishedAt) throw new NotFoundException('Published project not found'); return { id: row._id, slug: row.slug, content: row.publishedSnapshot, publishedAt: row.publishedAt.toISOString() }; }
function firstHomeErrors(content: ProjectContent) {
  const errors: string[] = [];
  if (content.home.stages.length !== 3) errors.push('home.stages');
  for (const locale of ['ru', 'en'] as const) for (const field of ['headline', 'subline'] as const) if (!content.home[field][locale].trim()) errors.push(`home.${field}.${locale}`);
  return errors;
}
@Injectable()
export class ContentService {
  constructor(@Inject(Database) private readonly db: Database, @Inject(MutationGate) private readonly gate: MutationGate, @Inject(MediaService) private readonly media: MediaService, @Inject(Revalidation) private readonly revalidation: Revalidation) {}
  async list() { return (await this.db.projects.find().sort({ updatedAt: -1 }).lean()).map(projectDto); }
  async row(id: string) { const row = await this.db.projects.findById(id).lean(); if (!row) throw new NotFoundException('Project not found'); return row; }
  async get(id: string) { return projectDto(await this.row(id)); }
  async selection(): Promise<HomeSelection> { const home = await this.db.home.findById('home').lean(); return { first: home?.first || null, second: home?.second || null }; }
  private async assertNotSelected(id: string) { const home = await this.selection(); if (home.first === id || home.second === id) throw new ConflictException('Choose another homepage project before removing this publication'); }
  private assertRevision(row: ProjectRow, revision: number) { if (row.revision !== revision) throw new ConflictException({ message: 'Project changed in another editor; reload before saving', revision: row.revision }); }
  private async catchUnique<T>(promise: Promise<T>): Promise<T> { try { return await promise; } catch (error) { if ((error as { code?: number }).code === 11000) throw new ConflictException('Slug is already in use'); throw error; } }
  async create(body: unknown) {
    const input = validate(createProjectSchema, body);
    return this.gate.mutate(async () => {
      const row = await this.catchUnique(this.db.projects.create({ _id: randomUUID(), slug: input.slug, revision: 0, draft: input.draft, publishedSnapshot: null, firstPublishedAt: null, publishedAt: null, updatedAt: new Date() }));
      return projectDto(row.toObject());
    });
  }
  async save(id: string, body: unknown) {
    const input = validate(saveProjectSchema, body);
    return this.gate.mutate(async () => {
      const row = await this.row(id); this.assertRevision(row, input.revision);
      if (row.firstPublishedAt && row.slug !== input.slug) throw new ConflictException('Slug cannot change after first publication');
      const updated = await this.catchUnique(this.db.projects.findOneAndUpdate({ _id: id, revision: input.revision }, { $set: { slug: input.slug, draft: input.draft, updatedAt: new Date() }, $inc: { revision: 1 } }, { new: true }).lean().exec());
      if (!updated) throw new ConflictException('Project revision changed');
      return projectDto(updated);
    });
  }
  async publish(id: string, revision: number) {
    const result = await this.gate.mutate(async () => {
      const row = await this.row(id); this.assertRevision(row, revision);
      const errors = publicationErrors(row.draft);
      if ((await this.selection()).first === id) errors.push(...firstHomeErrors(row.draft));
      if (errors.length) throw new BadRequestException({ message: 'Both languages and all publication fields must be complete', errors });
      await this.media.verifyReferences(row.draft);
      const now = new Date();
      const updated = await this.db.projects.findOneAndUpdate({ _id: id, revision }, { $set: { publishedSnapshot: structuredClone(row.draft), publishedAt: now, firstPublishedAt: row.firstPublishedAt || now, updatedAt: now }, $inc: { revision: 1 } }, { new: true }).lean();
      if (!updated) throw new ConflictException('Project revision changed');
      return projectDto(updated);
    });
    await this.revalidation.refresh([result.slug]); return result;
  }
  async unpublish(id: string, revision: number) {
    const result = await this.gate.mutate(async () => {
      const row = await this.row(id); this.assertRevision(row, revision); await this.assertNotSelected(id);
      const updated = await this.db.projects.findOneAndUpdate({ _id: id, revision }, { $set: { publishedSnapshot: null, publishedAt: null, updatedAt: new Date() }, $inc: { revision: 1 } }, { new: true }).lean();
      if (!updated) throw new ConflictException('Project revision changed');
      return projectDto(updated);
    });
    await this.revalidation.refresh([result.slug]); return result;
  }
  async remove(id: string, revision: number) {
    const result = await this.gate.mutate(async () => {
      const row = await this.row(id); this.assertRevision(row, revision); await this.assertNotSelected(id);
      const deleted = await this.db.projects.deleteOne({ _id: id, revision });
      if (!deleted.deletedCount) throw new ConflictException('Project revision changed');
      return row;
    });
    await this.revalidation.refresh([result.slug]); return { ok: true };
  }
  async setHome(body: unknown): Promise<HomeSelection> {
    const input = validate(homeSelectionSchema, body);
    const result = await this.gate.mutate(async () => {
      const [first, second] = await Promise.all([this.row(input.first), this.row(input.second)]);
      if (!first.publishedSnapshot || !second.publishedSnapshot) throw new BadRequestException('Homepage projects must be published');
      const errors = [...publicationErrors(first.publishedSnapshot), ...firstHomeErrors(first.publishedSnapshot)];
      if (errors.length) throw new BadRequestException({ message: 'First homepage project requires three complete stages in both languages', errors });
      await this.db.home.findByIdAndUpdate('home', { first: input.first, second: input.second }, { upsert: true });
      return { selection: input, slugs: [first.slug, second.slug] };
    });
    await this.revalidation.refresh(result.slugs); return result.selection;
  }
  async preview(id: string): Promise<PublishedProject> { const row = await this.row(id); return { id: row._id, slug: row.slug, content: row.draft, publishedAt: row.publishedAt?.toISOString() || row.updatedAt.toISOString() }; }
  async publicProject(slug: string) { const row = await this.db.projects.findOne({ slug, publishedSnapshot: { $ne: null } }).lean(); if (!row) throw new NotFoundException('Published project not found'); return publishedDto(row); }
  async publicRoutes() { return (await this.db.projects.find({ publishedSnapshot: { $ne: null } }).select('slug publishedAt').sort({ publishedAt: -1 }).lean()).map(row => ({ slug: row.slug, publishedAt: row.publishedAt!.toISOString() })); }
  async publicHome(): Promise<HomeResponse> {
    const home = await this.selection();
    const find = async (id: string | null) => { if (!id) return null; const row = await this.db.projects.findOne({ _id: id, publishedSnapshot: { $ne: null } }).lean(); return row ? publishedDto(row) : null; };
    const [first, second] = await Promise.all([find(home.first), find(home.second)]); return { first, second };
  }
}
