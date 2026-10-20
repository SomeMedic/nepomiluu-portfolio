# Production: nepomiluu.art

Git repository: `https://github.com/SomeMedic/nepomiluu-portfolio`. Operator SSH alias: `ag-nazi`.
Production secrets, passwords, private keys, Mongo data and generated QA output are excluded from Git.

## Automated release

Pushes to `main` run `.github/workflows/deploy.yml`: lint, unit/API tests, operational tests, production build, type checks and browser tests. Only after verification does Actions advance `deploy-ready` to the tested commit. `nepomiluu-deploy.timer` checks that public branch every two minutes. No incoming deploy SSH key, sudo user or GitHub token is needed on the host.

The root-owned `/usr/local/sbin/nepomiluu-deploy` validates the full SHA against current `origin/main`, creates a release checkout, builds pinned Docker images, backs up an existing release, starts Compose and runs HTTPS smoke checks. Actions waits for `/.well-known/deployment.json`, written only after the checks and release switch succeed. A failed release attempts to restore the previous application images. Database changes require backward compatibility.

- `/opt/nepomiluu/repository.git` — public Git mirror.
- `/opt/nepomiluu/releases/<SHA>` — release checkouts.
- `/opt/nepomiluu/current` — successfully deployed release.
- `/opt/nepomiluu/runtime` — isolated Node 24 runtime for operational scripts.
- `/etc/nepomiluu/portfolio.env` — runtime secrets, root only, mode 600.
- `/etc/nepomiluu/admin-credentials.json` — generated initial CMS credentials, root only, mode 600. Email: portfolio contact `unepomilueva@mail.ru`.
- `/var/backups/nepomiluu` — seven latest daily backup bundles.

The `nepomiluu` Compose project owns separate Mongo/media volumes and networks. It exposes only `127.0.0.1:3080`; the pre-existing host Nginx owns 80/443. Always use both Compose files. Never use `down -v` on a deployed application.

```sh
systemctl status nepomiluu-deploy.timer nepomiluu-deploy.service
journalctl -u nepomiluu-deploy.service -n 100 --no-pager
cd /opt/nepomiluu/current
docker compose --env-file /etc/nepomiluu/portfolio.env -f compose.yaml -f deploy/compose.host.yaml ps
/opt/nepomiluu/runtime/bin/node scripts/public-smoke.mjs https://nepomiluu.art
```

Bootstrap seed creates the two supplied published cases and homepage selection once. Repeated seeds preserve owner edits. The initial owner is created once from the private server file; deployments do not reset their password.

## HTTPS

Host config: `/etc/nginx/sites-available/nepomiluu.art.conf`, from `deploy/nginx/nepomiluu.art.conf`. Certbot uses `/var/www/certbot` for HTTP-01 and stores certificates in `/etc/letsencrypt/live/nepomiluu.art`. The existing Certbot timer renews certificates; a domain-specific hook tests and reloads Nginx. Containers do not receive TLS private keys.

```sh
nginx -t
certbot renew --cert-name nepomiluu.art --dry-run
systemctl list-timers certbot.timer nepomiluu-deploy.timer
```

## Backup and rollback

Daily backup shares the deployment lock, briefly locks CMS writes, archives Mongo/media with checksums, rotates logs and keeps seven bundles. Public reads continue.

```sh
cd /opt/nepomiluu/current
/opt/nepomiluu/runtime/bin/node scripts/backup.mjs --env-file /etc/nepomiluu/portfolio.env --output-dir /var/backups/nepomiluu
/opt/nepomiluu/runtime/bin/node scripts/restore.mjs --env-file /etc/nepomiluu/portfolio.env --bundle /var/backups/nepomiluu/portfolio-YYYYMMDDHHMMSS_ID.tar.gz --restore-root /var/backups/nepomiluu/restore-checks --smoke
```

Restore targets a new `portfolio_restore_*` database and separate media directory; the working database is untouched. Roll application code back with a revert on `main` through CI. For an emergency manual rollback, stop the deployment timer, select a previous release and its `APP_VERSION`, run Compose `up -d --no-build --wait`, and update the private env/current symlink only after checks. Resume the timer after `main` contains the intended rollback.

Updates to installed deployment scripts, Nginx or systemd files require an explicit operator update. Source copies do not silently rewrite host service configuration. Local backups do not cover loss of the whole server/disk.

References: [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [Certbot webroot/renewal](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).
