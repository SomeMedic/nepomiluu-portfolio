#!/usr/bin/env bash
# Public Git read only. No GitHub token, webhook or incoming deploy SSH key.
set -euo pipefail
repository=https://github.com/SomeMedic/nepomiluu-portfolio.git
revision=$(git ls-remote "$repository" refs/heads/deploy-ready | cut -f1)
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 0
if [[ -L /opt/nepomiluu/current && $(basename "$(readlink -f /opt/nepomiluu/current)") == "$revision" ]]; then exit 0; fi
exec /usr/local/sbin/nepomiluu-deploy "$revision"
