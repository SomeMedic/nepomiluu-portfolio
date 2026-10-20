# Portfolio API

NestJS API on `/api`, MongoDB via Mongoose. Run commands from the workspace root after `pnpm install`. Node 24 is required.

- `pnpm dev:api` — local API on `127.0.0.1:4000`.
- `pnpm --filter @portfolio/api build` — bundles API and CLI to `apps/api/dist`.
- `ADMIN_EMAIL=<email>` plus a password supplied through `ADMIN_PASSWORD` or stdin, then `pnpm admin:create` — create/reset the sole owner and revoke all sessions. Password length 12–1024. Never put real credentials in tracked files or command history.
- `pnpm seed` — insert the supplied published Clypse and Fomina cases only when their slugs do not exist, and initialize homepage slots only when no selection exists. Repeated runs preserve saved content and selection.

API reads environment from the process. Compose injects the root env file. For local shell development, export the relevant values before starting the API. Required production settings: `MONGODB_URI`, `INTERNAL_SECRET` (32+ characters), `PUBLIC_ORIGIN` (HTTPS), `MEDIA_DIR`, `WEB_INTERNAL_URL`. Optional: `API_HOST`, `API_PORT`, `PUBLIC_ASSETS_DIR`, `BACKUP_LOCK_FILE`.

Admin writes require a valid `portfolio_session` HttpOnly cookie and `x-csrf-token` returned by login/session. Cookie Secure is enabled in production, SameSite is Strict. Sessions expire after 12 hours and password resets revoke all sessions. Login is limited to five attempts per IP per fifteen minutes. The reverse proxy must be the sole public entry point and overwrite forwarded IP headers.

Projects use revision-based optimistic writes. Publish/unpublish accept `{revision}`. DELETE uses `?revision=<current>`. Slugs cannot change after first publication. Public endpoints expose only `publishedSnapshot`; saving a draft cannot change the published response. Homepage selection references two published projects; the first requires exactly three complete localized stages and headline/subline.

Uploads accept static JPEG/PNG/WebP/AVIF by decoder validation, at most 20 MiB and 40 million pixels. Metadata is removed and derivatives are stored as `MEDIA_DIR/<uuid>/{thumb,page,full}.webp`; original paths are never accepted. Uploads are immutable, and a public request is allowed only while a published snapshot references the ID. Authenticated owners can access draft media. Built-in Fomina assets are explicitly whitelisted.

Run **one API process/replica**. Its mutation queue serializes project/home/media mutations and drains before a backup lock returns. Internal backup endpoints require `x-internal-secret`: POST `/api/internal/backup/lock` with `{ttlSeconds:300}` (30–900), GET `/status`, POST `/unlock` with `{token}`. A persistent lease under `MEDIA_DIR/.backup-lock.json` blocks content changes across an API restart until unlock or expiry. Backups must finish before lease expiry and exclude ephemeral sessions. Run owner/seed CLI only with the API paused, and never during backup; its persistent-lock check rejects an existing backup lease.

Publishing, unpublishing, deletion and home selection request internal web cache revalidation. Web cache TTL of 60 seconds is the fallback when that request cannot reach Next.js.
