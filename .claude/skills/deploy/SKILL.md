---
name: deploy
description: Deploy the PerfIA Diagnostic IA app. Detects the deployment path from CLAUDE.md (Coolify or GitHub Actions + Traefik), runs pre-flight checks (git, schema migrations, configuration, image build), pushes or triggers the pipeline, then verifies the live instance. Designed for non-technical users.
---

> **Contexte PerfIA Diagnostic IA.** Ce skill vient du squelette PerfIA Diagnostic IA. Ce projet n'a ni organisations, ni
> publications, ni votes : les participants répondent sans compte (routes publiques de `pocketbase/pb_hooks/diag.pb.js`),
> `users` ne contient que l'équipe. Références à jour : `docs/modele-de-donnees.md`, `docs/securite.md`,
> `docs/accessibilite.md`. Ignorer les contrôles qui portent sur des briques retirées (inscription par domaine, IA
> vocale, notifications, pièces jointes).

# Deploy

You are a deployment assistant. Your job is to help the user ship their application with minimal friction: pre-flight checks, push or pipeline trigger, and verification that the new version is live.

This skill is designed for non-technical users. Explain everything in plain language.

## TONE & APPROACH

- **Match the user's language.** If they write in French, respond in French. If in English, respond in English. If the user only typed `/deploy` with no text, default to English.
- **Friendly, clear, patient.** Deploying can be stressful -- be reassuring.
- **Explain what's happening at each step.** Don't just run commands silently.
- **Use standard dev terminology** (Docker, SSH, pipeline, production, container) -- but don't expose infrastructure internals they wouldn't know (Traefik labels, compose overlays).
- **Always ask before `git push`** and before triggering a deployment.

## BEFORE YOU START

### 1. Read project state

- `VERSION` (current version).
- `CLAUDE.md`: the `## Deployment Status` section written by `/setup-deploy`. Read `Deployment path:` (`coolify` or `github-traefik`) and the domain(s). If the section is missing, fall back to `## Deployment` (written by `/start`); if nothing is recorded, tell the user deployment hasn't been set up yet and invoke `/setup-deploy`, then resume.
- `git remote get-url origin`, `git status`, `git log --oneline -5`, current branch.

### 2. Detect the path

- **`coolify`**: follow PATH A.
- **`github-traefik`**: follow PATH B.

## COMMON PRE-FLIGHT

Present the results as a checklist.

**Git state**
- Uncommitted changes? Warn:
  > You have uncommitted changes. The deployment builds from what's pushed to GitHub, not your local files. Want to commit them first?
  Offer to commit (show the list of files and a proposed message; wait for a yes).
- Local branch ahead of the remote (`git fetch` then `git status -sb` or `git log origin/main..HEAD`)? It will need a push (asked in the path steps).
- Not on `main`? Say which branch Coolify / the pipeline deploys (`main`) and ask how to proceed.

**Schema changes**
- Check whether `pocketbase/pb_schema.json` changed since the last deployed commit (`git diff --stat <last deployed ref or origin/main>..HEAD -- pocketbase/`) without a **new** file in `pocketbase/pb_migrations/`.
- If so, stop and explain:
  > You changed the database structure (`pb_schema.json`), but a running instance only applies migrations it hasn't seen yet. The first import migration already ran on your server, so this change would be ignored there. We need a new migration in `pocketbase/pb_migrations/` first (the guides in `.claude/skills/start/guides/` show the exact pattern: a re-import for additions, an explicit migration for renames and removals).
  Offer to write it, run `make test`, and only then continue.
- Also warn if an existing file in `pocketbase/pb_migrations/` was modified: migrations that already ran are never re-run.

**Tests**
- Suggest `make test` before a production deployment (throwaway PocketBase instance, a few seconds). If it fails, stop and help fix.

## PATH A: COOLIFY

### A1. Push

If commits are not on the remote:
> Your latest commits aren't on GitHub yet, so Coolify can't see them. Shall I push `main` now?

On yes: `git push origin main`.

### A2. Trigger the deployment

Read `Auto-deploy on push` in `## Deployment Status`:
- **yes**: "Coolify starts the deployment automatically after the push. You can follow it in Coolify > your resource > Deployments."
- **no / unknown**: "Open Coolify > your resource and click **Redeploy**. Tell me when it's started."

Explain what Coolify does: builds the image from the root `Dockerfile` (downloads PocketBase, copies hooks, migrations, schema and `web/`), starts the new container on the same data volume, applies pending migrations at start-up, and switches traffic once the healthcheck passes. It usually takes 1-3 minutes.

### A3. Verify

Poll the health endpoint every 10 seconds for up to 5 minutes:

```bash
curl -s -o /dev/null -w "%{http_code}" https://{domain}/api/health
```

Health only proves PocketBase is up, not that the **new** version is live. If `web/index.html` changed in the pushed commits, compare:

```bash
curl -s https://{domain}/ | shasum -a 256
shasum -a 256 web/index.html
```

If hashes differ after the deployment finished, the old container may still be serving: ask the user to check the Coolify deployment log.

## PATH B: GITHUB ACTIONS + TRAEFIK

### B1. Detect GitHub tooling

1. `which gh`, then `gh auth status`. If not authenticated: ask the user to run `! gh auth login`.
2. Otherwise check for GitHub MCP tools (`mcp__github__*`).
3. If neither: recommend `brew install gh` (macOS). The user needs it to deploy.

### B2. Configuration check

- `gh secret list`: at least `SSH_PRIVATE_KEY`. `gh variable list`: at least `DEPLOY_HOST` (and `DEPLOY_USER`, `SSH_PORT`, default `kosmio` / `2234`).
- `gh api repos/{owner}/{repo}/environments`: `dev` and `prod` exist.
- `HOST_NAME` in `infra/deploy/overlays/{env}/.env.{env}` is not the `your-domain.com` placeholder.
- If something is missing after `/setup-deploy` ran, explain and propose the fix (ask before changing anything).

### B3. Push and image build

- If commits are not on the remote, ask, then `git push origin main`.
- `dev.yml` runs on every push to `main` (and on tags, or manually): hadolint, identical-Dockerfiles check, then builds and pushes `ghcr.io/<owner>/<slug>-app:<VERSION>`.
- Find the run for the pushed commit: `gh run list --workflow=dev.yml --limit=5` (match `headSha` with `git rev-parse HEAD`, e.g. `--json databaseId,headSha,status,conclusion`). Watch it: `gh run watch {run_id}`.
- No run for this commit (e.g. nothing was pushed)? Offer `gh workflow run dev.yml` and watch it.
- If it fails, read `gh run view {run_id} --log-failed` and explain (a common one: "Dockerfile (racine, Coolify) et infra/docker/app/Dockerfile (CI) divergent" -> the two Dockerfiles must stay identical).

**About `VERSION`:** the image tag is the content of `VERSION`. Pushing new code without changing `VERSION` overwrites the image with the same tag (the deployment still pulls the new one). For a production release, suggest bumping `VERSION` first so the previous image stays available for a rollback.

Present a summary:
> **Pre-flight check:**
> - Git: [clean / X uncommitted changes / X commits not pushed]
> - Schema: [no change / new migration present / migration missing]
> - Configuration: [ready / missing -- run /setup-deploy]
> - Build: [image ready for vX.Y.Z / build needed / build failed]

### B4. Choose environment

> Where do you want to deploy?
> 1. **Dev** -- your staging/testing environment
> 2. **Prod** -- production

### B5. Version and backup

- Version: use `VERSION`. Don't ask.
- `backup_before` (default `true`): archives the `pb_data` volume on the server (`~/<slug>/backups/`, last 10 kept) before restarting. Keep it `true`; only pass `false` if the user explicitly asks (e.g. a quick redeploy on dev). There is no database reset option: data is never wiped by a deployment.

### B6. Deploy

Confirm:

> **Deployment summary:**
> - **Environment:** {env}
> - **Version:** {version}
> - **Backup before restart:** {yes/no}
>
> Ready to deploy?

Then:

```bash
gh workflow run deploy.yml \
  -f environment={env} \
  -f version={version} \
  -f backup_before={true|false}
```

Poll `gh run list --workflow=deploy.yml --limit=1` until the new run appears, then `gh run watch {run_id}`.

Explain while it runs:
> The pipeline is now:
> 1. Connecting to the server via SSH
> 2. Copying the infrastructure files and the secrets
> 3. Pulling the Docker image for v{version}
> 4. {If backup: "Saving a copy of the data (pb_data)"}
> 5. Starting the containers (pending migrations run at start-up)
> 6. Checking that PocketBase answers on /api/health
>
> This usually takes 2-5 minutes.

## POST-DEPLOYMENT (both paths)

**If success:**

> ## Deployed!
>
> **Version {version}** is now live{ on **{env}**}.
> - Application: https://{domain}/
> - Admin console: https://{domain}/_/
> - Agent instructions (MCP): https://{domain}/llms.txt
>
> Give it a minute, then check it out!

- Coolify: the domain comes from `## Deployment Status`. GitHub path: `HOST_NAME` in `infra/deploy/overlays/{env}/.env.{env}`.
- Omit the `/llms.txt` line if `pocketbase/pb_hooks/mcp.pb.js` no longer exists.
- Quick checks you can run yourself: `curl -s -o /dev/null -w "%{http_code}"` on `/`, `/_/` and `/llms.txt` (expect `200`); `curl -s https://{domain}/llms.txt | head -5` should show the application name, not "Acme" (otherwise Settings > Application name is not set).
- **First deployment:** remind the pending items from `## Deployment Status` (superuser, Settings > Application name and URL, proxy headers, mail, S3 backups). See `/setup-deploy` steps A5-A7 / B9.
- **Reminder:** any future change to `pocketbase/pb_schema.json` needs a new migration in `pocketbase/pb_migrations/` to reach this instance.

**If failure:**

> ## Deployment failed
>
> [Read the logs (Coolify deployment log provided by the user, or `gh run view {run_id} --log-failed`), then explain in plain language what went wrong -- don't paste raw output]
>
> **Common causes:**
> - **Server unreachable** (SSH connection failed, GitHub path) -- run `gh variable list` and verify `DEPLOY_HOST`, `DEPLOY_USER` (default: `kosmio`) and `SSH_PORT` (default: `2234`). If a variable is wrong, fix it with `gh variable set`. If everything looks right, tell the user to call Luc to the rescue. He'll help -- probably -- if they ask nicely. And bring a Neipa, it can't hurt.
> - **Image not found / denied** (GitHub path) -- the build didn't run for this version, or `DOCKER_REGISTRY_REPOSITORY` in `.env.base` doesn't match the GHCR owner. Try `/deploy --build-first`.
> - **Health check timeout** -- PocketBase didn't start: often a failing migration or a hook syntax error. Read the container logs (Coolify > Logs, or `ssh -p 2234 kosmio@{host}` then `docker logs --tail 50 {slug}-app`). Fix, `make test` locally, redeploy.
> - **Build failed in Coolify** -- usually the PocketBase download (network) or a Dockerfile change: read the build log.
> - **Port or domain conflict** -- another service uses the domain or the proxy route.

Then investigate: check variables and logs, try to fix. Escalate to Luc only if you can't resolve it yourself. Data is safe in both cases: the volume `/pb/pb_data` is untouched by a failed deployment, and the GitHub path keeps a pre-restart archive when `backup_before` was true.

**Rollback:** Coolify: redeploy a previous commit from the Deployments list. GitHub path: `gh workflow run deploy.yml -f environment={env} -f version={previous version}` (needs that image tag to exist). Warn that a rollback does not undo migrations already applied.

## ARGUMENTS

- No argument: interactive mode (full checks)
- `--env dev|prod`: skip environment selection (GitHub path)
- `--yes`: skip confirmations **except** `git push` of unreviewed commits and production deployments
- `--build-first`: trigger `dev.yml` before deploying, without asking (GitHub path)
- `--check`: run the pre-flight and the live checks only, deploy nothing

$ARGUMENTS
