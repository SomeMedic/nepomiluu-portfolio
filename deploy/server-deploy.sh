#!/usr/bin/env bash
# Install root-owned as /usr/local/sbin/nepomiluu-deploy.
# Called by a local systemd service after Actions advances deploy-ready.
set -Eeuo pipefail
umask 077
[[ $# == 1 && "$1" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected a full commit SHA' >&2; exit 64; }
revision=$1
base=/opt/nepomiluu
env_file=/etc/nepomiluu/portfolio.env
runtime="$base/runtime/bin/node"
exec 9>/run/lock/nepomiluu-deploy.lock
flock -w 1800 9
git --git-dir="$base/repository.git" fetch --depth=1 origin main
[[ $(git --git-dir="$base/repository.git" rev-parse FETCH_HEAD) == "$revision" ]] || {
    echo 'Refusing a revision that is not current origin/main' >&2; exit 65;
}
release="$base/releases/$revision"
if [[ ! -d "$release" ]]; then
    git --git-dir="$base/repository.git" worktree add --detach "$release" "$revision"
fi
cd "$release"
dc() { APP_VERSION="$revision" docker compose --env-file "$env_file" -f compose.yaml -f deploy/compose.host.yaml "$@"; }
dc config --quiet
dc build --pull
previous=''
if [[ -L "$base/current" ]]; then previous=$(readlink -f "$base/current"); fi
# Builds do not interrupt the running application. Capture data before switching.
if [[ -n "$previous" && -e /etc/nepomiluu/initialized ]]; then
    "$runtime" "$previous/scripts/backup.mjs" --env-file "$env_file" --output-dir /var/backups/nepomiluu
fi
# Do not switch to a superseded commit after a long build.
[[ $(git ls-remote https://github.com/SomeMedic/nepomiluu-portfolio.git refs/heads/main | cut -f1) == "$revision" ]] || {
    echo 'A newer main revision arrived during build; waiting for its CI.' >&2; exit 65;
}
state=$(mktemp -d /etc/nepomiluu/.release-state.XXXXXX)
cp -p "$env_file" "$state/env"
if [[ -f /var/lib/nepomiluu/deployment.json ]]; then cp -p /var/lib/nepomiluu/deployment.json "$state/ack"; fi
initialized=false
if [[ -e /etc/nepomiluu/initialized ]]; then initialized=true; fi
cleanup() { rm -f "$state/env" "$state/ack"; rmdir "$state"; }
trap cleanup EXIT
rollback() {
    status=$?
    trap - ERR
    set +e
    if [[ -n "$previous" && "$previous" != "$release" ]]; then
        echo 'Deployment failed; restoring the previous application images.' >&2
        cd "$previous"
        APP_VERSION="$(basename "$previous")" docker compose --env-file "$env_file" -f compose.yaml -f deploy/compose.host.yaml up -d --no-build --wait --wait-timeout 240 || true
    fi
    cp -p "$state/env" "$env_file"
    if [[ -n "$previous" ]]; then
        ln -sfn "$previous" "$base/current.next"
        mv -Tf "$base/current.next" "$base/current"
    elif [[ -L "$base/current" && $(readlink -f "$base/current") == "$release" ]]; then
        unlink "$base/current"
    fi
    if [[ -f "$state/ack" ]]; then cp -p "$state/ack" /var/lib/nepomiluu/deployment.json;
    else rm -f /var/lib/nepomiluu/deployment.json; fi
    if [[ "$initialized" == false ]]; then rm -f /etc/nepomiluu/initialized; fi
    exit "$status"
}
trap rollback ERR
dc up -d --no-build --wait --wait-timeout 180 mongo
if [[ ! -e /etc/nepomiluu/initialized ]]; then
    # A failed first attempt may have left API running; stop it before CLI writes.
    dc stop api
    dc run --rm --no-deps -T api node dist/cli.js seed
    if [[ -f /etc/nepomiluu/admin-credentials.json ]]; then
        owner_email=$(python3 -c 'import json; print(json.load(open("/etc/nepomiluu/admin-credentials.json"))["email"])')
        python3 -c 'import json,sys; sys.stdout.write(json.load(open("/etc/nepomiluu/admin-credentials.json"))["password"])' |
            dc run --rm --no-deps -T -e "ADMIN_EMAIL=$owner_email" api node dist/cli.js owner
    fi
fi
dc up -d --no-build --wait --wait-timeout 240
curl --fail --silent --show-error --retry 4 --retry-delay 2 https://nepomiluu.art/api/health
"$runtime" "$release/scripts/public-smoke.mjs" https://nepomiluu.art
# The durable version changes only after all checks pass.
python3 - "$env_file" "$revision" <<'PY'
import os, pathlib, sys
path = pathlib.Path(sys.argv[1])
lines = [line for line in path.read_text().splitlines() if not line.startswith('APP_VERSION=')]
temporary = path.with_suffix('.pending')
temporary.write_text('\n'.join(lines + ['APP_VERSION=' + sys.argv[2]]) + '\n')
os.chmod(temporary, 0o600)
temporary.replace(path)
PY
ln -sfn "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
touch /etc/nepomiluu/initialized
install -d -m 755 /var/lib/nepomiluu
python3 - "$revision" <<'PY'
import pathlib, json, os, sys, datetime
path=pathlib.Path('/var/lib/nepomiluu/deployment.pending')
path.write_text(json.dumps({'version':sys.argv[1],'deployedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})+'\n')
os.chmod(path,0o644)
path.replace('/var/lib/nepomiluu/deployment.json')
PY
trap - ERR
dc ps
echo "Deployed $revision to https://nepomiluu.art"
