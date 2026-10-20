import { z } from 'zod';
export const locales = ['ru', 'en'] as const;
export type Locale = typeof locales[number];
export const localizedSchema = z.object({ ru: z.string().max(30000), en: z.string().max(30000) });
export type Localized = z.infer<typeof localizedSchema>;
export const emptyLocalized = (): Localized => ({ ru: '', en: '' });
export const imageSchema = z.object({ mediaId: z.string().min(1).max(100), alt: localizedSchema });
export type ImageRef = z.infer<typeof imageSchema>;
const base = { id: z.string().min(1).max(100) };
const caption = { caption: localizedSchema };
export const annotationSchema = z.object({ id: z.string().min(1), x: z.number().min(0).max(1), y: z.number().min(0).max(1), text: localizedSchema });
export const blockSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('text'), title: localizedSchema, body: localizedSchema }),
  z.object({ ...base, type: z.literal('image'), image: imageSchema, ...caption }),
  z.object({ ...base, type: z.literal('gallery'), images: z.array(imageSchema).min(1).max(12), ...caption }),
  z.object({ ...base, type: z.literal('split'), image: imageSchema, title: localizedSchema, body: localizedSchema }),
  z.object({ ...base, type: z.literal('comparison'), before: imageSchema, after: imageSchema, ...caption }),
  z.object({ ...base, type: z.literal('annotated'), image: imageSchema, annotations: z.array(annotationSchema).max(20), ...caption })
]);
export type CaseBlock = z.infer<typeof blockSchema>;
export const stageSchema = z.object({ label: localizedSchema, title: localizedSchema, body: localizedSchema, image: imageSchema.nullable(), annotations: z.array(annotationSchema).max(20) });
export const contentSchema = z.object({
  title: localizedSchema, summary: localizedSchema, category: localizedSchema,
  role: localizedSchema, period: localizedSchema, status: localizedSchema,
  seoTitle: localizedSchema, seoDescription: localizedSchema,
  cover: imageSchema.nullable(), blocks: z.array(blockSchema).max(80),
  home: z.object({ headline: localizedSchema, subline: localizedSchema, stages: z.array(stageSchema).max(3) })
});
export type ProjectContent = z.infer<typeof contentSchema>;
export type StoryStage = z.infer<typeof stageSchema>;
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(80);
export const createProjectSchema = z.object({ slug: slugSchema, draft: contentSchema });
export const saveProjectSchema = z.object({ revision: z.number().int().nonnegative(), slug: slugSchema, draft: contentSchema });
export const revisionSchema = z.object({ revision: z.number().int().nonnegative() });
export const homeSelectionSchema = z.object({ first: z.string().min(1), second: z.string().min(1) }).refine(v => v.first !== v.second, 'Choose two different projects');
export interface Project { id: string; slug: string; revision: number; draft: ProjectContent; publishedSnapshot: ProjectContent | null; firstPublishedAt: string | null; publishedAt: string | null; updatedAt: string }
export interface PublishedProject { id: string; slug: string; content: ProjectContent; publishedAt: string }
export interface HomeSelection { first: string | null; second: string | null }
export interface HomeResponse { first: PublishedProject | null; second: PublishedProject | null }
export interface Media { id: string; width: number; height: number; mime: string; bytes: number; hash: string; originalName: string; createdAt: string; url: string }
export interface SessionInfo { email: string; csrfToken: string }
export interface ApiError { message: string; errors?: unknown }
export function imageUrl(image: ImageRef, variant = 'page'): string {
  if (image.mediaId.startsWith('builtin:')) return `/assets/${image.mediaId.slice(8)}.webp`;
  return `/api/media/${encodeURIComponent(image.mediaId)}/${variant}`;
}
export function collectMedia(content: ProjectContent): ImageRef[] {
  const images: ImageRef[] = content.cover ? [content.cover] : [];
  for (const stage of content.home.stages) if (stage.image) images.push(stage.image);
  for (const block of content.blocks) {
    if ('image' in block) images.push(block.image);
    if (block.type === 'gallery') images.push(...block.images);
    if (block.type === 'comparison') images.push(block.before, block.after);
  }
  return images;
}
export function publicationErrors(content: ProjectContent): string[] {
  const errors: string[] = [];
  for (const field of ['title', 'summary', 'category', 'role', 'period', 'status', 'seoTitle', 'seoDescription'] as const)
    for (const locale of locales) if (!content[field][locale].trim()) errors.push(`${field}.${locale}`);
  if (!content.blocks.length) errors.push('blocks');
  if (!content.cover) errors.push('cover');
  for (const block of content.blocks) {
    for (const field of ['title', 'body', 'caption'] as const) if (field in block) {
      const value = (block as unknown as Record<string, Localized>)[field];
      for (const locale of locales) if (!value?.[locale].trim()) errors.push(`blocks.${block.id}.${field}.${locale}`);
    }
    if (block.type === 'annotated') for (const annotation of block.annotations)
      for (const locale of locales) if (!annotation.text[locale].trim()) errors.push(`annotation.${annotation.id}.${locale}`);
  }
  for (const image of collectMedia(content)) for (const locale of locales)
    if (!image.alt[locale].trim()) errors.push(`alt.${image.mediaId}.${locale}`);
  const ids = content.blocks.map(b => b.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate-block-id');
  for (const [i, stage] of content.home.stages.entries()) {
    if (!stage.image) errors.push(`home.stages.${i}.image`);
    for (const locale of locales) for (const field of ['label', 'title', 'body'] as const)
      if (!stage[field][locale].trim()) errors.push(`home.stages.${i}.${field}.${locale}`);
    for (const annotation of stage.annotations) for (const locale of locales)
      if (!annotation.text[locale].trim()) errors.push(`home.stages.${i}.annotation.${annotation.id}.${locale}`);
  }
  return errors;
}
export function emptyContent(): ProjectContent {
  return { title: emptyLocalized(), summary: emptyLocalized(), category: emptyLocalized(), role: emptyLocalized(), period: emptyLocalized(), status: emptyLocalized(), seoTitle: emptyLocalized(), seoDescription: emptyLocalized(), cover: null, blocks: [], home: { headline: emptyLocalized(), subline: emptyLocalized(), stages: [] } };
}
