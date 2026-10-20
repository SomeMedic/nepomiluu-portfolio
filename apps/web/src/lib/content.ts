import 'server-only';

import { connection } from 'next/server';
import { contentSchema, slugSchema, type HomeResponse, type PublishedProject } from '@portfolio/contracts';
import { seedProjects } from '@portfolio/contracts/seed';

const CACHE_OPTIONS = { revalidate: 60, tags: ['portfolio'] };
const PREVIEW_DATE = '2026-10-19T00:00:00.000Z';

export class ContentUnavailableError extends Error {
  constructor() { super('Content is temporarily unavailable. Please try again.'); this.name = 'ContentUnavailableError'; }
}

function origin(value: string, name: string, httpsOnly = false): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute HTTP(S) origin`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || (httpsOnly && url.protocol !== 'https:')) {
    throw new Error(`${name} must be an ${httpsOnly ? 'HTTPS' : 'HTTP(S)'} origin without credentials, path, query or fragment`);
  }
  return url;
}

export function getSiteUrl(): URL {
  const configured = process.env.SITE_URL || process.env.PUBLIC_ORIGIN;
  if (!configured && process.env.NODE_ENV === 'production') throw new Error('SITE_URL or PUBLIC_ORIGIN is required in production');
  return origin(configured || 'http://localhost:3000', 'SITE_URL', process.env.NODE_ENV === 'production');
}

export function isStaticContentPreview(): boolean {
  if (process.env.ALLOW_STATIC_CONTENT !== 'true') return false;
  if (process.env.NODE_ENV === 'production') throw new Error('Static content preview is disabled in production');
  return true;
}

function previewProjects(): PublishedProject[] {
  return seedProjects.map(project => ({ id: `local-preview:${project.slug}`, slug: project.slug, content: project.draft, publishedAt: PREVIEW_DATE }));
}

function parseProject(value: unknown): PublishedProject {
  if (!value || typeof value !== 'object') throw new ContentUnavailableError();
  const project = value as Record<string, unknown>;
  if (typeof project.id !== 'string' || typeof project.slug !== 'string' || !slugSchema.safeParse(project.slug).success || typeof project.publishedAt !== 'string' || !Number.isFinite(Date.parse(project.publishedAt))) throw new ContentUnavailableError();
  const content = contentSchema.safeParse(project.content);
  if (!content.success) throw new ContentUnavailableError();
  return { id: project.id, slug: project.slug, content: content.data, publishedAt: project.publishedAt };
}

async function readPublic(path: string, notFoundAllowed = false): Promise<unknown> {
  const configured = process.env.API_INTERNAL_URL;
  if (!configured && process.env.NODE_ENV === 'production') throw new ContentUnavailableError();
  const base = origin(configured || 'http://127.0.0.1:4000', 'API_INTERNAL_URL');
  try {
    const response = await fetch(new URL(`/api/public/${path}`, base), { cache: 'force-cache', next: CACHE_OPTIONS, signal: AbortSignal.timeout(8000) });
    if (notFoundAllowed && response.status === 404) return null;
    if (!response.ok) throw new ContentUnavailableError();
    return await response.json();
  } catch { throw new ContentUnavailableError(); }
}

export async function getHome(): Promise<HomeResponse> {
  await connection();
  if (isStaticContentPreview()) {
    const projects = previewProjects();
    return { first: projects.find(project => project.slug === 'clypse') || null, second: projects.find(project => project.slug === 'fomina') || null };
  }
  const value = await readPublic('home');
  if (!value || typeof value !== 'object' || !('first' in value) || !('second' in value)) throw new ContentUnavailableError();
  return { first: value.first === null ? null : parseProject(value.first), second: value.second === null ? null : parseProject(value.second) };
}

export async function getProject(slug: string): Promise<PublishedProject | null> {
  await connection();
  if (!slugSchema.safeParse(slug).success) return null;
  if (isStaticContentPreview()) return previewProjects().find(project => project.slug === slug) || null;
  const value = await readPublic(`projects/${encodeURIComponent(slug)}`, true);
  return value === null ? null : parseProject(value);
}

export async function getRoutes(): Promise<Array<{ slug: string; publishedAt: string }>> {
  await connection();
  if (isStaticContentPreview()) return seedProjects.filter(project => project.publish).map(project => ({ slug: project.slug, publishedAt: PREVIEW_DATE }));
  const value = await readPublic('routes');
  if (!Array.isArray(value)) throw new ContentUnavailableError();
  return value.map((route: unknown) => {
    if (!route || typeof route !== 'object' || !('slug' in route) || !('publishedAt' in route) || typeof route.slug !== 'string' || !slugSchema.safeParse(route.slug).success || typeof route.publishedAt !== 'string' || !Number.isFinite(Date.parse(route.publishedAt))) throw new ContentUnavailableError();
    return { slug: route.slug, publishedAt: route.publishedAt };
  });
}
