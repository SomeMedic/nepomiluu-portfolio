import 'reflect-metadata';
import { hash } from 'argon2';
import { z } from 'zod';
import { readConfig } from './config.js';
import { Database } from './database.js';
import { MutationGate } from './mutation-gate.js';
import { passwordOptions } from './auth.js';
import { createProjectSchema, publicationErrors } from '@portfolio/contracts';
import { randomUUID } from 'node:crypto';
import { MediaService } from './media.js';
const config = readConfig();
const gate = new MutationGate(config);
const db = new Database(config);
try {
  await db.ready();
  if ((await gate.status()).locked) throw new Error('Content is locked for backup; retry after the backup finishes');
  if (process.argv[2] === 'owner') {
    const email = z.string().email().max(254).parse(process.env.ADMIN_EMAIL).toLowerCase();
    let password = process.env.ADMIN_PASSWORD || '';
    if (!password && !process.stdin.isTTY) { const chunks: Buffer[] = []; for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk)); password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, ''); }
    if (password.length < 12 || password.length > 1024) throw new Error('Set ADMIN_EMAIL and provide a 12-1024 character ADMIN_PASSWORD via environment or password on stdin. No default account is created.');
    await gate.mutate(async () => {
      await db.owners.findByIdAndUpdate('owner', { email, passwordHash: await hash(password, passwordOptions), updatedAt: new Date() }, { upsert: true });
      await db.sessions.deleteMany({});
    });
    console.log('Owner account saved; all existing sessions revoked.');
  } else if (process.argv[2] === 'seed') {
    const module = await import('@portfolio/contracts/seed');
    const projects = (module as unknown as { seedProjects: { slug: string; draft: unknown; publish?: boolean }[] }).seedProjects;
    if (!Array.isArray(projects)) throw new Error('Seed module must export seedProjects');
    let added = 0;
    for (const seed of projects) {
      const input = createProjectSchema.parse(seed);
      await gate.mutate(async () => {
        if (await db.projects.exists({ slug: input.slug })) return;
        const publish = seed.publish === true;
        const errors = publicationErrors(input.draft);
        if (publish && errors.length) throw new Error(`Seed publication ${input.slug} incomplete: ${errors.join(', ')}`);
        if (publish) await new MediaService(db, config).verifyReferences(input.draft);
        const now = new Date();
        await db.projects.create({ _id: randomUUID(), slug: input.slug, revision: 0, draft: input.draft, publishedSnapshot: publish ? structuredClone(input.draft) : null, firstPublishedAt: publish ? now : null, publishedAt: publish ? now : null, updatedAt: now });
        added++;
      });
    }
    // Bootstrap the homepage once; repeated seeds preserve the owner's selection.
    const first = await db.projects.findOne({ slug: 'clypse', publishedSnapshot: { $ne: null } }).lean();
    const second = await db.projects.findOne({ slug: 'fomina', publishedSnapshot: { $ne: null } }).lean();
    if (first && second) await gate.mutate(async () => {
      await db.home.updateOne({ _id: 'home' }, { $setOnInsert: { first: first._id, second: second._id } }, { upsert: true });
    });
    console.log(`Seed complete: ${added} projects inserted; existing edits preserved.`);
  } else throw new Error('Usage: node dist/cli.js owner|seed');
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
finally { await db.onModuleDestroy(); }


