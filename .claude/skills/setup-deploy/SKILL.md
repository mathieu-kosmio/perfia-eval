---
name: setup-deploy
description: Interactive wizard to set up deployment for a PerfIA Diagnostic IA app (PocketBase in one container). Coolify by default (Docker Compose resource, domain, secrets, superuser, backups, e-mails), or GitHub Actions + Traefik (secrets, variables, environments, domains). Also creates .local/env.sh for local development. Run this before your first deployment.
---

> **Contexte PerfIA Diagnostic IA.** Ce skill vient du squelette PerfIA Diagnostic IA. Ce projet n'a ni organisations, ni
> publications, ni votes : les participants répondent sans compte (routes publiques de `pocketbase/pb_hooks/diag.pb.js`),
> `users` ne contient que l'équipe. Références à jour : `docs/modele-de-donnees.md`, `docs/securite.md`,
> `docs/accessibilite.md`. Ignorer les contrôles qui portent sur des briques retirées (inscription par domaine, IA
> vocale, notifications, pièces jointes).

# Deployment Setup

You are an interactive deployment setup wizard. Your job is to prepare everything needed to run the application in production: the hosting resource, the domain, the secrets, the first administrator, backups and e-mails, plus the local development environment file.

After running this skill, the user should be able to run `/deploy` and ship.

## TONE & APPROACH

- **Match the user's language.** If they write in French, respond in French. If in English, respond in English. If the user only typed `/setup-deploy` with no text, default to English.
- **Friendly, clear, patient.** This is a wizard, not a terminal.
- **Explain what each secret or setting is for** in plain language. Not everyone knows what a "superuser", an "environment variable" or an "S3 bucket" is.
- **Non-technical users should be able to follow along.** Don't assume knowledge of Coolify, GitHub Actions, SSH or Docker.
- **You cannot click in Coolify or in the PocketBase console.** Give the user precise step-by-step instructions, one screen at a time, and wait for confirmation.
- **Secrets are never written in the repository.** Only `.local/env.sh` (gitignored), Coolify secrets or GitHub secrets. Never echo a secret back in a summary: say "set", not the value.

## WHAT THIS APP NEEDS

There are **no cryptographic secrets to generate**: PocketBase creates its own signing keys inside its data volume. What the deployment needs:

| Item | Required? | What it is |
|------|-----------|------------|
| Domain | Yes | The address of the app. Interface at `/`, API at `/api/`, console at `/_/`, MCP at `/mcp`. |
| Superuser | Yes | The administrator account of the PocketBase console (`/_/`). Created once, after the first deployment. |
| Settings > Application | Yes | Application name and public URL. Used in e-mails (`{APP_NAME}`, links), by the notifications (deep links), by OAuth metadata and by `/llms.txt`. PocketBase defaults to "Acme" and `http://localhost:8090`: always change them. |
| `APP_AI_PROVIDER` + `APP_AI_KEY` | Optional | Global AI key for the voice capture (`openai` or `mistral`). A key can also be set per organisation in the console (`organisations` record, fields `ai_provider` / `ai_api_key`). |
| `APP_BREVO_API_KEY` + `APP_MAIL_FROM` | **Required for sign-up** (or SMTP) | E-mails through the Brevo API (`mail.pb.js`): sign-up confirmation (members cannot log in before confirming their address), password reset, notifications. Alternative: SMTP in Settings > Mail settings. Without any e-mail channel, new members can only be activated by hand (console > users > `verified`). |
| S3 backups | Strongly recommended | Settings > Backups. The whole app state is one volume (`/pb/pb_data`). |

The database schema needs no manual step: the migration `pocketbase/pb_migrations/1757500000_import_schema.js` imports `pocketbase/pb_schema.json` on the first start.

## BEFORE YOU START

### 1. Read project state

- `CLAUDE.md`: look for `## Deployment` (path chosen by `/start`: `Deployment path: coolify` or `github-traefik`) and for a previous `## Deployment Status` section.
- `docker-compose.yaml` and `Dockerfile` at the root (Coolify path).
- `infra/deploy/base/.env.base` (`PROJECT_SLUG`, `DOCKER_REGISTRY_REPOSITORY`), `infra/deploy/overlays/dev/.env.dev`, `infra/deploy/overlays/prod/.env.prod` (GitHub path).
- `.github/workflows/dev.yml` and `.github/workflows/deploy.yml`: confirm the expected secrets and variables. Today `deploy.yml` reads the secrets `SSH_PRIVATE_KEY`, `SECRET_APP_AI_PROVIDER`, `SECRET_APP_AI_KEY`, `SECRET_APP_BREVO_API_KEY`, `SECRET_APP_MAIL_FROM` and the variables `DEPLOY_HOST`, `DEPLOY_USER`, `SSH_PORT`. If the file differs, trust the file.
- Which features are still in the code: `pocketbase/pb_hooks/ai.pb.js` (AI), `notify.pb.js` / `mail.pb.js` (e-mails), `mcp.pb.js` (MCP). Skip the questions for removed features.
- `.local/env.sh`: does it exist already? (Read only the variable names, never print the values.)
- `git remote get-url origin`: GitHub org/repo.

### 2. Choose the path

If `CLAUDE.md` records a path, confirm it. Otherwise explain and ask:

> There are two ways to deploy this app:
> 1. **Coolify (recommended)**: a hosting dashboard on your server. You point it at this repository, it builds the app, handles the domain and HTTPS, and stores the secrets. No pipeline to maintain.
> 2. **GitHub Actions + Traefik**: GitHub builds a Docker image, then deploys it over SSH to a server prepared with Ansible. Best if your team already runs this pipeline or needs separate dev and prod servers.

Record the choice; it drives the rest of the wizard and `/deploy`.

## PATH A: COOLIFY (default)

### A1. Coolify access

Ask: "Do you have access to a Coolify instance with a server attached?"

> If not, Coolify has to be installed on a server first (https://coolify.io/docs). If you'd rather have someone do it for you, ask Luc -- he'll get your machine ready. Fair warning though: it's gonna cost you a Neipa. And trust me, you don't want to skip the Neipa. Luc will hold a grudge, and you really, *really* don't want him to have a grudge on you.

Wait for confirmation. Also make sure the code is pushed to the Git remote Coolify will read (`git status`, `git log origin/main..HEAD`); pushing requires the user's confirmation.

### A2. Create the resource

Guide the user:

1. In Coolify: **Projects** > choose or create a project > **+ New** > **Docker Compose** (from a Git repository). Choose the GitHub App (private repo) or "Public repository".
2. Repository: the URL from `git remote get-url origin`, branch `main`.
3. **Build pack: Docker Compose**, compose file location `/docker-compose.yaml`. Coolify builds the root `Dockerfile` (service `app`, `build: .`).
4. Do not add port mappings: the compose file exposes nothing on the host on purpose; Coolify's proxy routes the traffic.

### A3. Domain

Ask for the domain (e.g. `app.example.fr`). Then:

> In the resource, open the **`app` service** settings and set **Domains** to `https://app.example.fr`. The compose file declares `SERVICE_FQDN_APP_8090`, which tells Coolify the app listens on port 8090. If Coolify asks for the port explicitly, enter `https://app.example.fr:8090`: the `:8090` is the container port, it is not exposed publicly.
>
> At your DNS provider, point the domain (A record, or CNAME) to the Coolify server. Coolify requests the HTTPS certificate automatically.

### A4. Environment variables (secrets)

Explain: "Environment variables are settings given to the app at start-up. Coolify stores them encrypted; mark the keys as secret so they are hidden in the interface."

In the resource > **Environment Variables**, Coolify lists the variables read by `docker-compose.yaml`:
- `APP_AI_PROVIDER` (`openai` or `mistral`) and `APP_AI_KEY`: ask whether the user has a key. Present the GDPR note: Mistral is French (EU); OpenAI is US (transfer outside the EU, to mention in the privacy policy) and is the only one offering the realtime voice interview. Leave empty to disable AI globally (per-organisation keys remain possible).
- `APP_BREVO_API_KEY` and `APP_MAIL_FROM` (e.g. `Mon App <noreply@example.fr>`): see A7.

The root `docker-compose.yaml` only passes these four variables. If the user needs `APP_AI_BASE_URL`, `APP_AI_STT_MODEL`, `APP_AI_CHAT_MODEL`, `APP_AI_REALTIME_MODEL` or `APP_AI_VOICE`, add the matching `- APP_AI_...=${APP_AI_...:-}` lines under `environment:` in `docker-compose.yaml` (they are already listed in `infra/deploy/base/docker-compose.base.yml`), commit, and set them in Coolify.

Then: **Deploy**. Watch the build logs with the user until the container is healthy (the image has a healthcheck on `/api/health`). Check from here: `curl -s https://{domain}/api/health` should return `"API is healthy."`.

### A5. Superuser (first administrator)

> Now we create the administrator of the PocketBase console. In Coolify, open the resource > **Terminal**, pick the `app` container, and run:
> ```
> /pb/pocketbase superuser upsert you@example.fr 'a-long-password' --dir /pb/pb_data
> ```
> Use a long password and store it in your password manager. Then open `https://{domain}/_/` and log in.

Alternative: on a brand-new instance PocketBase also prints a one-time installer link in the container logs; the terminal command is more reliable.

Good to know: if the same e-mail is later used to sign up in the application and confirmed, `account.pb.js` gives that member account the console password at each console login. The alignment is one-way: a member account can never change the console password.

### A6. Console settings

Guide the user in `https://{domain}/_/` > **Settings**:
1. **Application**: *Application name* (the project name, used in e-mails and on the OAuth consent page) and *Application URL* `https://{domain}` (used in e-mail links, notification deep links `#item=`, `/llms.txt` and OAuth metadata). Save.
2. In the same screen, if available: **User IP proxy headers**: `X-Forwarded-For` (Coolify's proxy adds it), so that rate limits and login alerts see the real visitor IP.
3. **Mail settings**: *Sender name* and *Sender address* (used as the default sender, including by notifications). SMTP only if Brevo is not used (see A7).
4. **Backups**: enable **S3**: endpoint, bucket, region, access key, secret (prefer an EU provider, e.g. Scaleway or OVHcloud Object Storage). Set an automatic schedule (e.g. `0 3 * * *`) and the number of backups to keep. Then click **Initialize new backup** once and check it appears.

### A7. E-mails

Ask which channel the user wants:
- **Brevo API (default):** create an account at brevo.com, then *SMTP & API* > *API keys* > generate a v3 key -> `APP_BREVO_API_KEY` in Coolify. Validate the sender domain in Brevo (*Senders, domains*: DKIM and DMARC records at the DNS provider), otherwise Brevo refuses to send. Set `APP_MAIL_FROM`. Redeploy so the variables are picked up.
- **SMTP:** console > Settings > Mail settings > *Use SMTP mail server*. Leave `APP_BREVO_API_KEY` empty (the relay is then inactive).
- **None:** warn that notifications, password reset and sign-in codes will not work.

Test: console > Settings > Mail settings > **Send test email**.

### A8. Auto-deploy (optional)

Explain the two options and record which one is active:
- Coolify **Auto Deploy** on push (GitHub App integration, or the resource's deploy webhook added to the GitHub repository).
- Manual: click **Redeploy** in Coolify after each push.

## PATH B: GITHUB ACTIONS + TRAEFIK

### B1. Detect GitHub tooling

1. Run `which gh`. If found: `gh auth status`. If not authenticated: ask the user to run `! gh auth login`.
2. If `gh` is not found, check for GitHub MCP tools (`mcp__github__*`).
3. If neither: recommend `brew install gh` (macOS). Let the user choose when they're ready.

Then `gh secret list`, `gh variable list`, `gh api repos/{owner}/{repo}/environments` to see what is already configured. Report: "I found X secrets and Y variables already configured. I'll skip those unless you want to change them."

### B2. Server setup check

Ask: "Do you have a server ready for deployment?"

> Before we set up the pipeline, you need a server where the application will run. We use Ansible to set up machines with Docker, Traefik, and everything needed.
>
> **If you don't have a server yet**, or need to set one up:
> - Use our Ansible playbook: https://gitlab.kosm.io/infra/ansible-host-setup
> - If you'd rather have someone do it for you, ask Luc -- he'll get your machine ready. Fair warning though: it's gonna cost you a Neipa. And trust me, you don't want to skip the Neipa. Luc will hold a grudge, and you really, *really* don't want him to have a grudge on you.
>
> **If your server is already set up**, let's continue!

If they ask you to run the Ansible playbook yourself:

> I can't run the Ansible playbook myself -- that repository isn't set up for AI yet and we don't want to risk it. Contact Luc, he'll handle it. And don't forget the Neipa.

### B3. Server connection

Ask only for the **deploy host** (IP or hostname). `DEPLOY_USER` is `kosmio` and `SSH_PORT` is `2234` by default across our infrastructure: don't ask.

### B4. SSH key

`SSH_PRIVATE_KEY` is a shared key managed centrally. If `gh secret list` shows it: skip. Otherwise tell the user to ask Luc. Never create or replace it unless explicitly asked.

### B5. Registry

`dev.yml` pushes `ghcr.io/<owner in lowercase>/<PROJECT_SLUG>-app:<VERSION>`, and the server pulls `${DOCKER_REGISTRY_REPOSITORY}${PROJECT_SLUG}-app:${APP_VERSION}`. Check that `DOCKER_REGISTRY_REPOSITORY` in `infra/deploy/base/.env.base` equals `ghcr.io/<owner in lowercase>/`; fix it if not (non-secret, committed).

### B6. Domains

Ask for the dev domain (e.g. `dev.example.fr`) and the prod domain (e.g. `example.fr`). Update `HOST_NAME` in `infra/deploy/overlays/dev/.env.dev` and `infra/deploy/overlays/prod/.env.prod`. Unknown yet: keep the `your-domain.com` placeholders and list them in "Still needed". Remind the user to point DNS to the server; Traefik obtains the certificates (Let's Encrypt, `ACME_EMAIL` in `.env.base`).

### B7. Optional service credentials

For each enabled feature, ask whether the user has the value now (skip otherwise, they can re-run `/setup-deploy`):
- AI: provider (`openai` / `mistral`) and key (same GDPR note as A4).
- Brevo: API key and sender (`APP_MAIL_FROM`), same explanations as A7.

### B8. GitHub environments, secrets and variables

Explain: "GitHub stores these secrets encrypted; only the deployment pipeline can read them. Environments keep dev and prod values apart."

```bash
gh api repos/{owner}/{repo}/environments/dev -X PUT
gh api repos/{owner}/{repo}/environments/prod -X PUT

gh variable set DEPLOY_HOST --body "{deploy_host}"
gh variable set DEPLOY_USER --body "kosmio"
gh variable set SSH_PORT --body "2234"

# Only for values provided, per environment (dev and prod may use different keys)
gh secret set SECRET_APP_AI_PROVIDER --env dev --body "{provider}"
gh secret set SECRET_APP_AI_KEY --env dev --body "{key}"
gh secret set SECRET_APP_BREVO_API_KEY --env dev --body "{key}"
gh secret set SECRET_APP_MAIL_FROM --env dev --body "{sender}"
# same four for --env prod
```

Pass secret values through `--body` from the user's input without printing them again. The SSH key is managed by Luc: don't touch it.

### B9. After the first deployment

These steps need a running instance: list them in the summary and remind them at the end of the first `/deploy`.
- **Superuser:** `ssh -p 2234 kosmio@{deploy_host}` then `docker exec -it {PROJECT_SLUG}-app /pb/pocketbase superuser upsert you@example.fr 'a-long-password' --dir /pb/pb_data`.
- **Console settings** at `https://{domain}/_/`: same as A6 (Application name and URL, User IP proxy headers `X-Forwarded-For`, Mail settings, S3 Backups). `deploy.yml` also archives `pb_data` on the server before each restart when `backup_before` is true, but that copy stays on the same machine: S3 backups are still needed.
- **E-mail test:** same as A7.

## BOTH PATHS

### Local development file: `.local/env.sh`

`scripts/pb.sh` (`make dev`) and `scripts/import-schema.sh` (`make schema-import`) load this file if it exists. It is gitignored. If it already exists, show the variable names it defines and ask before changing it.

```bash
# PerfIA Diagnostic IA local environment (gitignored). Loaded by scripts/pb.sh.
PB_ADMIN_EMAIL="admin@example.local"
PB_ADMIN_PASSWORD="{local password}"
# PB_PORT="8090"

# Voice capture (optional): openai or mistral
# APP_AI_PROVIDER=""
# APP_AI_KEY=""

# E-mails through Brevo (optional; leave commented to avoid sending real e-mails from dev)
# APP_BREVO_API_KEY=""
# APP_MAIL_FROM=""
```

- `PB_ADMIN_*` create or update the local superuser at each `make dev`. Local values must never be reused in production. A readable local password is fine; generate one with `openssl rand -hex 12` if the user prefers.
- AI key: only if the user wants to test voice capture locally (a separate key from production is better).
- After creating it, suggest `make dev`, then sign up on `http://127.0.0.1:8090/` with an e-mail on a non-consumer domain.

### Mark setup as done in `CLAUDE.md`

Add or update a `## Deployment Status` section (create `CLAUDE.md` with a short header if it does not exist). Never write secret values.

Coolify:

```markdown
## Deployment Status

`/setup-deploy` was run on {YYYY-MM-DD}.
- Deployment path: coolify
- Domain: https://{domain}
- Coolify resource: Docker Compose on `{repo}` branch `main`, service `app` port 8090
- Auto-deploy on push: {yes (GitHub App / webhook) | no (redeploy manually)}
- Secrets set in Coolify: {APP_AI_PROVIDER, APP_AI_KEY, APP_BREVO_API_KEY, APP_MAIL_FROM | none}
- Superuser created: {yes | pending}
- Console settings (Application name/URL, proxy headers, mail): {done | pending}
- S3 backups: {enabled | pending}
- E-mail channel: {Brevo | SMTP | none}
- Local env: .local/env.sh
```

GitHub + Traefik:

```markdown
## Deployment Status

`/setup-deploy` was run on {YYYY-MM-DD}.
- Deployment path: github-traefik
- Domains: dev https://{dev_domain}, prod https://{prod_domain}
- GitHub variables: DEPLOY_HOST, DEPLOY_USER, SSH_PORT
- GitHub secrets: SSH_PRIVATE_KEY (managed by Luc){, SECRET_APP_AI_PROVIDER, SECRET_APP_AI_KEY, SECRET_APP_BREVO_API_KEY, SECRET_APP_MAIL_FROM per environment}
- GitHub environments: dev, prod
- Superuser / console settings / S3 backups: {done | pending, after first deploy}
- E-mail channel: {Brevo | SMTP | none}
- Local env: .local/env.sh
```

Update the section on later runs.

### Summary

> ## Setup complete!
>
> **Local development:** `.local/env.sh` ready -- run `make dev`.
>
> **Deployment ({Coolify | GitHub Actions + Traefik}):**
> - [each item configured, with a checkmark]
>
> **Still needed:**
> - [anything skipped: domain placeholders, superuser, console settings, S3 backups, Brevo sender domain validation, AI key]
>
> You're ready to deploy! Run `/deploy` when you want to ship.

## ARGUMENTS

- No argument: interactive mode (full wizard)
- `--check`: only verify what's configured (Coolify: health URL and `CLAUDE.md` status; GitHub: `gh secret list`, `gh variable list`, environments), change nothing
- `--local-only`: only create `.local/env.sh`
- `--coolify` / `--github`: skip the path question

$ARGUMENTS
