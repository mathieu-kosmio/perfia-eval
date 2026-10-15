# Infrastructure Practices

This guide covers the Docker image, the two deployment paths (Coolify, or Docker Compose + Traefik driven by GitHub Actions), CI/CD, secrets, backups and local development for PerfIA Diagnostic IA.

---

## Architecture Overview

PerfIA Diagnostic IA ships as **one image**, `app`: the PocketBase binary, the hooks, the migrations, the schema and the web interface. Data lives in a single volume. There are two ways to deploy it:

1. **Coolify** (default): root `Dockerfile` + root `docker-compose.yaml`. Coolify builds the image, manages the domain, TLS and reverse proxy.
2. **Docker Compose + Traefik** on your own server: images built by GitHub Actions, deployed over SSH with the base + overlay pattern in `infra/deploy/`.

```
Dockerfile                               # Coolify build (must be identical to infra/docker/app/Dockerfile)
docker-compose.yaml                      # Coolify resource
VERSION                                  # Image tag
Makefile                                 # dev, test, schema-import, infra-*, build targets
.github/workflows/
├── dev.yml                              # Build & push the app image to GHCR
└── deploy.yml                           # SSH deployment with optional pb_data backup
infra/
├── docker/app/Dockerfile                # CI and Makefile build
├── make/make_app.mk                     # lint, build, test, stage, promote
└── deploy/
    ├── base/
    │   ├── .env.base                    # PROJECT_SLUG, network, registry, Traefik version, ACME e-mail
    │   └── docker-compose.base.yml      # traefik + app
    ├── overlays/
    │   ├── local/                       # Both services disabled (PocketBase runs natively)
    │   ├── dev/                         # Traefik + TLS, unless-stopped, memory limits
    │   └── prod/                        # Traefik + TLS, always, memory limits
    └── scripts/deploy.sh                # Unified compose wrapper
scripts/
├── pb.sh                                # Local PocketBase (make dev)
├── test.sh                              # Throwaway instance + tests (make test)
└── import-schema.sh                     # make schema-import
```

---

## Dockerfile

```dockerfile
FROM alpine:3.21
ARG PB_VERSION=0.40.3
ARG PB_SHA256_AMD64=8d81b6b7...
ARG PB_SHA256_ARM64=d5092815...
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q ".../v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
 && case "$TARGETARCH" in amd64) sum="$PB_SHA256_AMD64" ;; arm64) sum="$PB_SHA256_ARM64" ;; esac \
 && echo "$sum  /tmp/pb.zip" > /tmp/pb.zip.sha256 && sha256sum -c /tmp/pb.zip.sha256 \
 && unzip -q /tmp/pb.zip -d /pb && rm /tmp/pb.zip /tmp/pb.zip.sha256 && apk del unzip
COPY pocketbase/pb_hooks        /pb/pb_hooks
COPY pocketbase/pb_migrations   /pb/pb_migrations
COPY pocketbase/pb_schema.json  /pb/pb_schema.json
COPY web                        /pb/pb_public
WORKDIR /pb
EXPOSE 8090
VOLUME ["/pb/pb_data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8090/api/health"]
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations", "--publicDir=/pb/pb_public"]
```

**Rules:**
- The root `Dockerfile` (Coolify) and `infra/docker/app/Dockerfile` (CI, Makefile) must stay **identical**. `dev.yml` fails the build if `diff -q` finds a difference.
- `pb_schema.json` must be copied to `/pb/pb_schema.json`: the import migration reads it next to the hooks directory.
- `PB_VERSION` is pinned here and in `scripts/pb.sh` (`PB_VERSION` default): bump both together, update `PB_SHA256_AMD64` / `PB_SHA256_ARM64` from the release `checksums.txt`, then run `make test`. `scripts/pb.sh` checks the archive against that `checksums.txt` on its own.
- Keep `wget` in the image: the healthcheck and the deploy verification (`docker exec ... wget .../api/health`) use it.
- No build step, no Node in the image: the interface is static and hooks run in PocketBase's embedded JS engine.
- Hadolint must pass (`make lint`, and the `dev.yml` step).

---

## Data Volume

Everything persistent is in `/pb/pb_data`: `data.db` (SQLite), `auxiliary.db`, uploaded files (`storage/`) and local backups (`backups/`).

| Path | Volume |
|---|---|
| Coolify | `app_data:/pb/pb_data` |
| Compose dev / prod | `app-data`, named `${PROJECT_SLUG}-app-data` by the overlay |
| Local | `.local/pb_data` (plain directory) |

**Rules:**
- Never write data outside `/pb/pb_data`; the rest of the image is rebuilt on each deployment.
- Never mount the same volume in two running containers.
- `deploy.sh <env> kill --volumes` deletes the PocketBase data: only with a verified backup.

---

## Coolify Path

`docker-compose.yaml` at the root:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    environment:
      - SERVICE_FQDN_APP_8090
      - APP_AI_PROVIDER=${APP_AI_PROVIDER:-}
      - APP_AI_KEY=${APP_AI_KEY:-}
      - APP_BREVO_API_KEY=${APP_BREVO_API_KEY:-}
      - APP_MAIL_FROM=${APP_MAIL_FROM:-}
    volumes:
      - app_data:/pb/pb_data
    deploy:
      resources:
        limits:
          memory: 512M
volumes:
  app_data:
```

- Create a "Docker Compose" resource pointing to the repository. `SERVICE_FQDN_APP_8090` tells Coolify to route the resource domain to port 8090; Coolify handles TLS and the proxy.
- Define `APP_AI_PROVIDER`, `APP_AI_KEY`, `APP_BREVO_API_KEY`, `APP_MAIL_FROM` as Coolify environment variables, secrets marked as such.
- On first start PocketBase logs a one-time link to create the first superuser: open it from the container logs, or create it with `/pb/pocketbase superuser upsert <email> <password> --dir=/pb/pb_data` in the container terminal.
- Then, in the console (`/_/`): set the application name and URL (Settings > Application), mail settings if Brevo is not used, and S3 backups.
- `/deploy` pushes and redeploys; `/setup-deploy` walks through the first configuration.

**Rules:**
- Do not publish host ports in `docker-compose.yaml`: Coolify's proxy reaches the container.
- Any new `APP_*` variable read by a hook must be added to the `environment` list here, in `docker-compose.base.yml`, and in the overlay env files. Optional AI overrides (`APP_AI_BASE_URL`, model variables) are not listed yet: add them before relying on them in Coolify.
- A change of environment variable needs a redeploy (PocketBase reads variables at start).

---

## Docker Compose + Traefik Path

### Environment layering

1. `base/.env.base`: `PROJECT_SLUG=perfia-eval`, `DOCKER_NETWORK=${PROJECT_SLUG}-network`, `DOCKER_REGISTRY_REPOSITORY=ghcr.io/kosmio/`, `TRAEFIK_VERSION=v3.6.1`, `ACME_EMAIL`.
2. `overlays/<env>/.env.<env>`: `HOST_NAME`, `APP_VERSION`, `APP_AI_PROVIDER`, `APP_AI_KEY`, `APP_BREVO_API_KEY`, `APP_MAIL_FROM` (placeholders only).

`deploy.sh` passes both with `--env-file` (base first, overlay second) or, in CI, the merged file from `DOCKER_COMPOSE_ENV_FILE`.

### PROJECT_SLUG

`PROJECT_SLUG` in `.env.base` propagates to:
- container names: `${PROJECT_SLUG}-traefik`, `${PROJECT_SLUG}-app`
- network: `${PROJECT_SLUG}-network`
- volume names (dev, prod overlays): `${PROJECT_SLUG}-app-data`, `${PROJECT_SLUG}-traefik-certificates`
- image: `${DOCKER_REGISTRY_REPOSITORY}${PROJECT_SLUG}-app:${APP_VERSION}`
- compose project: `${PROJECT_SLUG}-<environment>`
- server paths used by `deploy.yml`: `~/${PROJECT_SLUG}/infra/deploy`, `~/${PROJECT_SLUG}/backups`
- CI image name in `dev.yml` (read with `grep '^PROJECT_SLUG='`)

### Base compose

`docker-compose.base.yml` defines `traefik` (Docker provider, `exposedbydefault=false`, entrypoints `web` :80 and `websecure` :443, ACME HTTP challenge resolver `letsencrypt-resolver`, certificates in `traefik-certificates`) and `app` (image above, `platform: linux/amd64`, all `APP_*` variables with empty defaults and `APP_INTERNAL_URL` defaulting to `http://127.0.0.1:8090`, `expose: 8090`, `app-data:/pb/pb_data`). The network `net` is named `${DOCKER_NETWORK}` and created by compose.

### Overlays

| Overlay | traefik | app |
|---|---|---|
| `local` | `profiles: [disabled]` | `profiles: [disabled]` |
| `dev` | ports 80 and 443, `restart: unless-stopped`, 256M | Traefik labels, `restart: unless-stopped`, 512M |
| `prod` | ports 80 and 443, `restart: always`, 256M | Traefik labels, `restart: always`, 512M |

`local` starts nothing: PocketBase runs natively with `make dev`. `deploy.sh local validate` still checks that the base stays valid. `.env.local` sets `APP_VERSION=local` and `HOST_NAME=localhost`.

Traefik labels on `app` (dev and prod), in list syntax so that `${PROJECT_SLUG}` is interpolated in the router names
(Compose interpolates values, never YAML keys):

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.${PROJECT_SLUG}-app.rule=Host(`${HOST_NAME}`)"
  - "traefik.http.routers.${PROJECT_SLUG}-app.entrypoints=websecure"
  - "traefik.http.routers.${PROJECT_SLUG}-app.tls.certresolver=letsencrypt-resolver"
  - "traefik.http.routers.${PROJECT_SLUG}-app-http.rule=Host(`${HOST_NAME}`)"
  - "traefik.http.routers.${PROJECT_SLUG}-app-http.entrypoints=web"
  - "traefik.http.routers.${PROJECT_SLUG}-app-http.middlewares=${PROJECT_SLUG}-redirect-to-https"
  - "traefik.http.middlewares.${PROJECT_SLUG}-redirect-to-https.redirectscheme.scheme=https"
  - "traefik.http.middlewares.${PROJECT_SLUG}-redirect-to-https.redirectscheme.permanent=true"
  - "traefik.http.services.${PROJECT_SLUG}-app.loadbalancer.server.port=8090"
```

One domain serves everything at the root: interface `/`, API `/api/`, console `/_/`, MCP `/mcp`, OAuth `/oauth/*`, `/llms.txt`. No path prefix, no strip middleware.

**Rules:**
- Container, network, volume and image names use `${PROJECT_SLUG}`; never hardcode the project name.
- The `app` service keeps `platform: linux/amd64` and `labels: <<: *common-labels` (Traefik network discovery).
- Overlays only add what changes per environment; the full service definition stays in the base.
- dev and prod overlays must keep the explicit volume `name:` (`${PROJECT_SLUG}-app-data`): the backup step of `deploy.yml` looks the volume up by that name.
- Router, service and middleware names are prefixed with `${PROJECT_SLUG}` so that several projects can share one Traefik. Keep the list syntax when adding labels. Note that each project's base still declares its own `traefik` service on ports 80 and 443: to share one Traefik, disable it in all but one project.

### `deploy.sh`

```bash
./infra/deploy/scripts/deploy.sh <local|dev|prod> <action> [--skip-services svc1,svc2] [extra args]
```

| Action | Description |
|---|---|
| `up` | `compose up -d` (with `--no-deps` when services are skipped) |
| `down` | Stop and remove containers |
| `logs` | Follow logs |
| `ps` | Service status |
| `pull` | Pull images (respects `--skip-services`) |
| `restart` | Restart services |
| `config` | Show the merged configuration |
| `validate` | `compose config --quiet` |
| `kill` | After a 5 s countdown, force-kill and remove the project's containers and networks; `--volumes` also removes volumes |

**Rules:**
- Always go through `deploy.sh` rather than raw `docker compose`: it layers env files and sets the project name.
- `PROJECT_SLUG` is read from `.env.base` by `grep`; keep it a plain `PROJECT_SLUG=value` line.
- `DOCKER_COMPOSE_ENV_FILE` replaces the overlay env file (the base file is still loaded first).

---

## Makefiles

Root `Makefile`:

| Target | Action |
|---|---|
| `dev` | `scripts/pb.sh` |
| `schema-import` | `scripts/import-schema.sh` |
| `test` | `scripts/test.sh` (through `make_app.mk`) |
| `lint`, `build` | Delegated to `infra/make/make_app.mk` |
| `stage` (alias of `publish`), `promote` | Delegated to `make_app.mk` |
| `infra-up`, `infra-down`, `infra-logs`, `infra-ps`, `infra-pull`, `infra-validate`, `infra-config`, `infra-kill` | `deploy.sh local <action>` |

`infra/make/make_app.mk` defines `SKELLYTO_APP_DOCKERFILE`, `SKELLYTO_APP_NAME := ${PROJECT_SLUG}-app` (slug read from `.env.base`) and `SKELLYTO_APP_IMG := ${SKELLYTO_APP_NAME}:${VERSION}`:
- `lint`: hadolint on `infra/docker/app/Dockerfile`
- `build`: `docker build --no-cache=true -f infra/docker/app/Dockerfile`
- `stage`: tag and push to `${CI_REGISTRY_URL}/<PROJECT_SLUG>-app:<VERSION>` (`CI_REGISTRY_URL` required)
- `promote`: no-op (images are tagged by version; `dev.yml` overwrites the tag of the current `VERSION` on every push to `main`, so bump `VERSION` before a release)

**Rules:**
- The version comes from `VERSION` only.
- Hadolint must pass before any push.

---

## CI/CD (GitHub Actions)

### Build & Push (`dev.yml`)

Triggers: push to `main`, any tag, manual dispatch. One job, `docker-app` (`packages: write`):
1. Checkout, log in to GHCR with `GITHUB_TOKEN`.
2. Read `version` from `VERSION` and `slug` from `.env.base`; lowercase the repository owner.
3. Hadolint on `infra/docker/app/Dockerfile`.
4. Fail if `Dockerfile` and `infra/docker/app/Dockerfile` differ.
5. Build with `--no-cache` and push `ghcr.io/<owner>/<slug>-app:<VERSION>`.

### Deploy (`deploy.yml`)

Manual dispatch, job bound to the GitHub environment of the same name. Inputs:
- `environment`: `dev` or `prod`
- `version`: `x.y.z` or `x.y.z-suffix` (validated by regex)
- `backup_before`: boolean, default `true`

Steps:
1. Checkout, read `slug`, validate inputs. `inputs.version` is passed through `env:` and checked against the regex before any other step uses it: never interpolate `${{ inputs.* }}` inside a script before validation.
2. Load `SSH_PRIVATE_KEY` into an SSH agent, write `vars.SSH_KNOWN_HOSTS` to `~/.ssh/known_hosts` (fallback with a warning: `ssh-keyscan` `DEPLOY_HOST` on `SSH_PORT`), write `~/.ssh/config`.
3. Write `/tmp/.env.secrets` (`umask 077`) from `SECRET_APP_AI_PROVIDER`, `SECRET_APP_AI_KEY`, `SECRET_APP_BREVO_API_KEY`, `SECRET_APP_MAIL_FROM`.
4. Create `~/<slug>/infra/deploy` and `~/<slug>/backups` on the server, copy `base`, `overlays/<env>` and `scripts` with `tar | ssh`, copy the secrets to `overlays/<env>/.env.secrets`.
5. Log the server in to GHCR with `GITHUB_TOKEN`, build a merged env file, set `APP_VERSION`, `deploy.sh <env> pull`, delete the merged file.
6. **Backup** (if `backup_before`): if the volume `<slug>-app-data` exists, stop `<slug>-app` for a consistent SQLite copy, archive the volume with an `alpine:3.21` container into `~/<slug>/backups/<UTC stamp>.tar.gz`, keep the 10 most recent archives.
7. Merge `.env.<env>` + `.env.secrets` into `.env.<env>.merged`, set `APP_VERSION`, `DOCKER_COMPOSE_ENV_FILE=... deploy.sh <env> up`, list containers; a `trap` deletes the secrets and merged files even when the deployment fails.
8. Verify: up to 30 attempts, 2 s apart, of `docker exec <slug>-app wget -q -O - http://localhost:8090/api/health`; print the last 50 log lines on failure.
9. Print a summary; on failure, print how to read logs and where backups are.

### Required GitHub configuration

**Secrets:** `SSH_PRIVATE_KEY`, `SECRET_APP_AI_PROVIDER`, `SECRET_APP_AI_KEY`, `SECRET_APP_BREVO_API_KEY`, `SECRET_APP_MAIL_FROM` (repository or `dev` / `prod` environment scope).

**Variables:** `DEPLOY_HOST`, `DEPLOY_USER`, `SSH_PORT` (optional).

**Rules:**
- `DOCKER_REGISTRY_REPOSITORY` in `.env.base` is the default for manual runs; `deploy.yml` appends `DOCKER_REGISTRY_REPOSITORY=ghcr.io/<lowercase owner>/` to the secrets file so that deployments always pull from where `dev.yml` pushed.
- The GHCR package must be pullable with the workflow token, or the server must be logged in with a longer-lived token.
- Keep `backup_before` on for prod. The deployment stops the app during the backup; plan for a short downtime.
- A new secret is added to the heredoc of step 3 **and** to the `environment` of `docker-compose.base.yml`; a non-secret setting goes in `.env.<env>`.

---

## Secrets and Environment Variables

| Variable | Read by | Secret |
|---|---|---|
| `APP_AI_PROVIDER` | `ai.js` | no |
| `APP_AI_KEY` | `ai.js` | yes |
| `APP_AI_BASE_URL`, `APP_AI_STT_MODEL`, `APP_AI_CHAT_MODEL`, `APP_AI_REALTIME_MODEL`, `APP_AI_VOICE` | `ai.js` | no |
| `APP_BREVO_API_KEY` | `mail.pb.js` | yes |
| `APP_MAIL_FROM` | `mail.pb.js` | no |
| `APP_INTERNAL_URL` | `mcp.js` | no |
| `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`, `PB_PORT`, `PB_VERSION` | `scripts/pb.sh`, `scripts/import-schema.sh` (local only) | password yes |

### Secrets merge pattern

1. CI writes `/tmp/.env.secrets` from GitHub secrets.
2. It is copied to `overlays/<env>/.env.secrets` on the server.
3. `cp .env.<env> .env.<env>.merged && cat .env.secrets >> .env.<env>.merged`: later lines win, so secrets override placeholders.
4. `DOCKER_COMPOSE_ENV_FILE` points `deploy.sh` to the merged file.
5. Both files are deleted after `up`.

### Gitignore

```gitignore
.local/
pb_data/
.env
.env.*
!.env.base
!.env.example
!infra/deploy/overlays/*/.env.local
!infra/deploy/overlays/*/.env.dev
!infra/deploy/overlays/*/.env.prod
infra/deploy/overlays/*/.env.secrets
*.merged
```

**Rules:**
- Never commit a real key, password or token. `.env.dev` and `.env.prod` carry placeholders only: empty values for provider keys.
- Local secrets go in `.local/env.sh`; Coolify secrets in Coolify; GitHub path secrets in GitHub secrets.
- Provider keys set per organisation (`organisations.ai_api_key`) are data, protected by the `hidden` flag and the backups' confidentiality.
- Never put a fake non-empty value in `APP_AI_KEY` or `APP_BREVO_API_KEY`: a non-empty key enables the AI buttons or the Brevo relay, which then fail. Leave them empty until real secrets are merged.

---

## Backups

Two complementary mechanisms:

1. **PocketBase backups** (console, Settings > Backups): scheduled ZIP archives of `pb_data`, stored in `pb_data/backups` or, preferably, on S3-compatible storage configured in the same screen. Enable S3 on every deployed instance: a backup inside the same volume does not survive the loss of the server.
2. **Volume archive before deployment** (`deploy.yml`, GitHub path): `~/<slug>/backups/<stamp>.tar.gz`, 10 kept, taken with the container stopped.

Coolify can also schedule volume backups on its side.

Restoring a volume archive (GitHub path):

```bash
docker stop <slug>-app
docker run --rm -v <slug>-app-data:/data -v ~/<slug>/backups:/backup alpine:3.21 \
  sh -c "rm -rf /data/* && tar xzf /backup/<stamp>.tar.gz -C /data"
./infra/deploy/scripts/deploy.sh <env> up
```

**Rules:**
- Never copy `data.db` while PocketBase is writing: stop the container or use the console backup, which is consistent.
- Test a restore on a dev instance before relying on a backup scheme.
- Backups contain personal data and provider keys: store them encrypted and with access restricted like production.

---

## Versioning

`VERSION` at the root holds the release version (`0.2.0`). It is used by:
- `dev.yml` for the image tag
- `make_app.mk` for `build` and `stage`

The `version` input of `deploy.yml` is typed by hand and written into `APP_VERSION` of the merged env file: it must match a tag pushed by `dev.yml`.

**Rules:**
- Bump `VERSION` for every release. `dev.yml` pushes the current `VERSION` tag on every push to `main`, overwriting the previous image with the same tag until `VERSION` changes.
- The MCP server version (`VERSION` in `pb_hooks/mcp.js`, `mcp/package.json`, `new McpServer({ version })` in `mcp/server.js`) is independent; bump it when tools change.

---

## Local Development

```bash
# 1. Optional local configuration (gitignored)
cat > .local/env.sh <<'EOF'
PB_ADMIN_EMAIL=me@company.fr
PB_ADMIN_PASSWORD=a-long-password
APP_AI_PROVIDER=mistral
APP_AI_KEY=...
EOF

# 2. Run PocketBase
make dev          # http://127.0.0.1:8090  (/ interface, /api/ API, /_/ console, /mcp MCP)

# 3. Tests on a throwaway instance
make test
```

`scripts/pb.sh`:
1. Detects `darwin` / `linux` and `arm64` / `amd64`.
2. Downloads PocketBase `PB_VERSION` (default `0.40.3`) into `.local/pocketbase` when missing or when `.local/pb_version` differs.
3. Sources `.local/env.sh` with `set -a`, so every variable reaches PocketBase.
4. Exports `APP_INTERNAL_URL=http://127.0.0.1:${PB_PORT}` (default port 8090) for the MCP loopback.
5. Upserts the superuser when `PB_ADMIN_EMAIL` and `PB_ADMIN_PASSWORD` are set.
6. Serves on `127.0.0.1:${PB_PORT}` with `--dir .local/pb_data --hooksDir pocketbase/pb_hooks --migrationsDir pocketbase/pb_migrations --publicDir web`, in the foreground, or with `--background` (log in `.local/server.log`). `--download-only` stops after step 2.

**Rules:**
- In local, PocketBase always runs natively, never in Docker; `infra-up` starts nothing by design.
- Hooks and `web/index.html` reload on save; a change in `.local/env.sh` needs a restart of `make dev`.
- After editing `pb_schema.json`, run `make schema-import` on the running instance (see POCKETBASE_PRACTICES.md).
- The server listens on `127.0.0.1` only. The microphone works on `localhost`; testing on a phone needs HTTPS (a deployed dev instance).
- Delete `.local/pb_data` to start from an empty database; migrations re-import the schema on next start.

---

## Sizing and Assumed Limits

- **Memory**: the app container is limited to **512 MB** (Coolify, dev, prod), Traefik to 256 MB. PocketBase idles at a few tens of megabytes; the limit leaves room for hooks, uploads and the in-process HTTP calls of the AI relay and MCP.
- **SQLite, one instance**: PocketBase is a single process writing to a local SQLite file. Scale vertically (CPU, RAM, fast disk), never horizontally.

**Rules:**
- Never run more than one replica of `app`, and never put two containers on the same `pb_data`: SQLite locking, the minute cron (`app_notify`, which would send e-mails twice) and in-memory OAuth codes (`app.store()`) all assume a single instance.
- Heavy work stays out of request handlers: e-mails go through the cron queue, realtime audio flows directly between browser and provider.
- The target is a handful of organisations and thousands of items. If a client requires high availability or a managed database, that is a change of backend, not a scaling setting.
- Raise the memory limit before the healthcheck starts failing under load; watch container memory in Coolify or `docker stats`.
