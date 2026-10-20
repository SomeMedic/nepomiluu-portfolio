import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

export async function inventoryBuiltinFiles(projects, directory) {
  const referenced = new Set();
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.mediaId === 'string' && value.mediaId.startsWith('builtin:')) {
      if (!/^builtin:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.mediaId)) throw new Error(`Unsafe builtin media ID: ${value.mediaId}`);
      referenced.add(value.mediaId);
    }
    for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child);
  };
  for (const project of projects) { walk(project.draft); walk(project.publishedSnapshot); }
  const found = [];
  for (const mediaId of [...referenced].sort()) {
    try {
      const file = await lstat(join(directory, `${mediaId.slice('builtin:'.length)}.webp`));
      if (file.isFile() && file.size > 0) found.push(mediaId);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Missing/empty references are reported by verifyReferences.
    }
  }
  return found;
}
