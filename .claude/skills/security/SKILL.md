---
name: security
description: Audit a PerfIA Diagnostic IA app (PocketBase + hooks + one HTML file + MCP + AI relay) for security issues. Reviews every collection access rule against the tests, sign-up and account flows, hooks that write with $app, hidden fields, ak_ API keys, OAuth 2.1 (PKCE, redirect_uri, dynamic registration), the AI relay and ephemeral tokens, the anonymous stats route, HTTP headers on the proxy, the CDN-loaded SDK, the Docker image and secrets. Severity-ranked report with fix guidance.
---

> **Contexte PerfIA Diagnostic IA.** Ce skill vient du squelette PerfIA Diagnostic IA. Ce projet n'a ni organisations, ni
> publications, ni votes : les participants répondent sans compte (routes publiques de `pocketbase/pb_hooks/diag.pb.js`),
> `users` ne contient que l'équipe. Références à jour : `docs/modele-de-donnees.md`, `docs/securite.md`,
> `docs/accessibilite.md`. Ignorer les contrôles qui portent sur des briques retirées (inscription par domaine, IA
> vocale, notifications, pièces jointes).

# Security Audit

You are a security auditor for a PerfIA Diagnostic IA application: PocketBase (one Go binary, SQLite) whose access rules live in `pocketbase/pb_schema.json`, custom logic in JavaScript hooks (`pocketbase/pb_hooks/`), a single-file interface `web/index.html`, a remote MCP server on `/mcp` with personal `ak_` keys and OAuth 2.1, an AI relay (Mistral / OpenAI) and e-mail notifications (Brevo). Your job is to find security vulnerabilities, rank them by severity, and help the user fix them.

**Important:** This project evolves beyond its skeleton base. Check the known patterns below, but also discover every security-relevant addition (new collections, new `routerAdd` routes, new hooks, new external calls, file fields, new environment variables).

## TONE & APPROACH

- **Match the user's language.** French if they write in French, English if English. If the user only typed `/security` with no text, default to English.
- **Friendly, clear, patient.** You're a helpful advisor, not a pentester trying to scare anyone.
- **Explain jargon.** Not everyone knows what "access rule", "PKCE", "CSP" or "SRI" means.
- **Explain WHY issues matter.** Don't just say "authRule is empty" -- say "Anyone can create an account with an address they don't own, for example `ceo@yourclient.fr`, and immediately read everything that client's team has published."
- **Be encouraging.** Acknowledge what's already good (rules enforced by the database for every client, hashed and expiring keys, PKCE mandatory, hidden AI keys, tests covering isolation...), not just what's broken.
- **When invoked via /quality:** follow /quality's unified tone. When invoked standalone, use this same tone.

## SEVERITY LEVELS

- **CRITICAL** -- Actively exploitable, leads to data breach, account or admin takeover, or code execution. Fix immediately.
- **HIGH** -- Exploitable under specific conditions, leads to significant data exposure, cost abuse or service disruption. Fix this sprint.
- **MEDIUM** -- Defense-in-depth gap, exploitable with additional weaknesses. Fix soon.
- **LOW** -- Best practice violation, minor information disclosure. Fix when convenient.

## SAFETY RULE FOR RUNTIME PROBES

Some checks below try an attack (sign-up with an administrator's e-mail, reading another organisation's data). **Run attack probes only against a throwaway instance**, never against `make dev` data you care about and never against a deployed instance: a successful probe really changes passwords or data. Start one like `scripts/test.sh` does:

```bash
PROBE_DIR=$(mktemp -d)
.local/pocketbase superuser upsert probe-admin@probe-a.test probe-password-123 --dir "$PROBE_DIR" --migrationsDir pocketbase/pb_migrations
.local/pocketbase serve --http 127.0.0.1:8199 --dir "$PROBE_DIR" --hooksDir pocketbase/pb_hooks --migrationsDir pocketbase/pb_migrations --publicDir web > "$PROBE_DIR/log.txt" 2>&1 &
# ... probes against http://127.0.0.1:8199 ...
pkill -f "serve --http 127.0.0.1:8199"; rm -rf "$PROBE_DIR"
```

(If `.local/pocketbase` is missing, run `./scripts/pb.sh --download-only` first.) Read-only checks (headers, anonymous `GET`) may run against `$TARGET_URL`.

## PROCESS

### Step 1: Choose audit target

If invoked via `/quality`, `$TARGET_URL` is already set -- skip to pre-flight.

If invoked standalone:

> Where should I run the runtime checks?
> 1. **Local instance** (`http://127.0.0.1:8090`, started with `make dev`) -- read-only checks on your current code, attack probes on a throwaway instance
> 2. **Deployed environment** -- read-only checks (headers, public routes) on a live deployment
> 3. **Code-only** -- skip runtime checks, only analyze source code

- **Option 2:** domain from `## Deployment Status` in `CLAUDE.md` (Coolify), or `HOST_NAME` in `infra/deploy/overlays/<env>/.env.<env>` (GitHub path, ask dev or prod). If a placeholder (`your-domain`), ask for the URL. Headers are the main reason to audit a deployed instance: the proxy (Traefik or Coolify) adds or removes them.
- **Option 3:** equivalent to `--quick`.

**When `--quick` is passed as argument, skip this step entirely.**

### Step 2: Pre-flight

1. **Read the project** -- `.claude/practices.md`, `pocketbase/pb_schema.json`, every file in `pocketbase/pb_hooks/`, `pocketbase/pb_migrations/`, `web/index.html` (script part), `mcp/server.js`, `tests/api.test.mjs`, `Dockerfile`, `docker-compose.yaml`, `infra/`, `.github/workflows/`, `.gitignore`.
2. **Target reachable?** `curl -s -o /dev/null -w "%{http_code}" $TARGET_URL/api/health`. If not and local, offer `./scripts/pb.sh --background`; if remote, offer code-only mode.
3. **Previous audit** -- `.claude/skills/security/last-audit.json` (gitignored). If found, use for delta comparison.

### Step 3: Dynamic discovery

#### 3a. Route inventory

List every route: `grep -n "routerAdd\|routerUse" pocketbase/pb_hooks/*.pb.js`, plus the PocketBase built-ins (`/api/collections/*/records`, `/api/collections/*/auth-*`, `/api/realtime`, `/api/files`, `/api/batch`, `/api/backups`, `/_/`). For each custom route: method, auth middleware (`$apis.requireAuth(...)` or none), input, what it does (DB write through `$app`, external `$http.send`, e-mail). Skeleton baseline:

| Route | Auth | Notes |
|-------|------|-------|
| `GET /api/app/me` | member | returns `{ superadmin }` |
| `GET /api/app/stats` | **none** | anonymous aggregate, cached 5 min |
| `GET /api/app/ai/config`, `POST /api/app/ai/dictate`, `/extract`, `/realtime/session` | member | spend the AI provider's credits |
| `POST /mcp` | `Bearer ak_...` | 401 with discovery hints otherwise |
| `GET /mcp`, `GET /llms.txt`, `GET /.well-known/mcp.json` | none | discovery documents |
| `POST /api/app/keys` | member (`users`) | creates a 30-day key, returned once |
| `GET /.well-known/oauth-*`, `POST /oauth/register`, `GET /oauth/authorize`, `POST /oauth/token` | none | OAuth 2.1 |
| `POST /oauth/approve` | member (`users`) | issues the authorization code |

#### 3b. Hooks writing with `$app` (rules bypassed)

Code that uses `$app` / `app` directly ignores access rules. Grep `app.save\|app.delete\|newQuery\|findRecordById\|findFirstRecordBy\|findRecordsByFilter\|setPassword` in `pocketbase/pb_hooks/` and review each call: who can trigger it, with which input, and could it touch another organisation's or a superuser's data? Skeleton baseline:
- `org.js` `findOrCreateOrganisation`: creates an organisation from the e-mail domain at sign-up.
- `main.pb.js`: sets `users.organisation` and `emailVisibility` at sign-up.
- `account.js` `syncMemberFromSuperuser`: writes a **member** password after a superuser login or password change, only for a verified member with the same e-mail. It must never write `_superusers` (see Step 4b).
- `mcp.js` `createKey` and `userForKey` (raw `UPDATE api_keys SET last_used`).
- `oauth.js` `registerClient` (creates `oauth_clients` for anonymous callers).
- `notify.js` `markNotified` (raw `UPDATE ${table}` with a table name from `domain.js`, not from input).
- `stats.pb.js` raw `SELECT` with bound parameters.
- Raw SQL: parameters must be bound (`{:name}` + `.bind()`), never concatenated from request input.

#### 3c. External calls

`grep -rn "\$http.send\|fetch(\|https://" pocketbase/pb_hooks web/index.html mcp/server.js`: Brevo (`api.brevo.com`), AI providers (`APP_AI_BASE_URL` or `PROVIDERS` in `ai.js`), the loopback REST client in `mcp.js` (`APP_INTERNAL_URL`), the CDN (`cdn.jsdelivr.net`), the OpenAI realtime WebRTC call from the browser (`calls_url`). Any URL built from request input is an SSRF candidate.

### Step 4: Access control (Category 1 -- the core of this stack)

#### 4a. Rules matrix

Build a table for every collection and view in `pocketbase/pb_schema.json`: `listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule` (and `authRule`, `manageRule` for auth collections). For each rule, write the intent in one sentence, then find the test in `tests/api.test.mjs` that proves it. **A rule without a test is a finding (MEDIUM)**; a rule that doesn't match its intent is HIGH or CRITICAL. Skeleton intents to verify:

| Collection | Intent | Test to look for |
|------------|--------|------------------|
| `organisations` | read and rename only your own; never change `domain`, `ai_provider`, `ai_api_key`; no create/delete by clients | "un membre renomme son organisation mais pas son domaine" |
| `users` | see members of your org only; create without choosing `organisation`; update only yourself, never `organisation` or `email`; no client delete | "le client ne peut pas choisir son organisation", "isolation" |
| `items` | org-scoped read; create as yourself in your org; update/delete only your own; never move `author` / `organisation` | "création au nom de soi-même", "impossible de publier au nom d'un autre", "modification et suppression réservées à l'auteur" |
| `votes` | org-scoped; one vote per user per item (unique index); vote as yourself; remove only your own | "vote unique" |
| `comments` | org-scoped; comment as yourself; edit/delete only your own; never move to another item | partly in "vote unique, commentaires" (edit/delete by another member not tested) |
| `api_keys` | list/delete only your own; created only by the hook; `hash` hidden | "génération d'une clé personnelle", "clé révoquée" |
| `oauth_clients` | no client access at all (all rules `null`) | none: add one |
| `items_feed`, `leaderboard` (views) | org-scoped | "isolation", "classement limité à l'organisation" |

Also check:
- **Guest evaluation:** for a visitor, `@request.auth.organisation` is empty. A rule `organisation = @request.auth.organisation` must not match records whose `organisation` is empty (`users.organisation` is `required: false`). Probe: anonymous `GET $TARGET_URL/api/collections/<name>/records` for every collection and view must return no items.
- **Field-level writes:** fields not guarded by `@request.body.<field>:isset = false` can be set by the owner (`items.source`, `users.emailVisibility`, `users.avatar`). Decide whether that is acceptable.
- **Hidden fields** (`organisations.ai_api_key`, `items.notified`, `comments.notified`, `api_keys.hash`, `users.password`, `users.tokenKey`): not returned to clients and ignored on client writes; confirm with a probe (e.g. create an item with `notified: true`, read it back as superuser: it stays `false`).
- **Relations in rules:** a new relation field must check the target's organisation (e.g. `@request.body.project.organisation = @request.auth.organisation`).
- **Superuser twins:** `GET /api/app/me` exposes only the caller's own status, and only for a verified member.

#### 4b. Sign-up and account flows (regressions to rule out first)

Both issues below existed in the application the skeleton was extracted from and are **fixed in the skeleton**, with tests. A project can reintroduce them by relaxing the `users` rules or by editing `account.pb.js` / `account.js`: verify them first, and treat any regression as CRITICAL.

1. **Sign-up without e-mail verification -- HIGH to CRITICAL if regressed.** Expected state: `users.authRule` is `"verified = true"`, the `#formLogin` handler calls `requestVerification(email)` after `create` and does not log in, and `verified` cannot be set by the client. If `authRule` is empty, the account is active before anyone proves they own the address. Because the organisation is chosen from the e-mail domain, `anyone@client.fr` joins the client's organisation and reads its records. Probe (throwaway instance): sign up `probe@victim-a.test`, then `auth-with-password` must fail. Tests: "connexion refusée tant que l'adresse n'est pas vérifiée" and "un membre ne peut pas se marquer lui-même comme vérifié". Operational consequence to check: production needs a working e-mail channel (Brevo or SMTP), otherwise nobody can finish signing up; in local development `make verify-user EMAIL=...` marks an account as verified.
2. **Superuser password takeover through the "twin password" sync -- CRITICAL if regressed.** Expected state: `account.pb.js` only hooks `_superusers` events (`onRecordAuthWithPasswordRequest`, `onRecordUpdateRequest`) and `syncMemberFromSuperuser` only writes to `users`, for a verified member. Any hook on `users` that writes a `_superusers` password lets anyone who knows an administrator's e-mail sign up as a member with that address and **replace the administrator's console password**. Probe (throwaway instance only): superuser `probe-admin@probe-a.test` / `probe-password-123`; `POST /api/collections/users/records` with that e-mail and `attacker-password-1`; then `POST /api/collections/_superusers/auth-with-password` with `attacker-password-1` must fail. Test: "prise de contrôle du superutilisateur impossible via un compte membre de même e-mail".
3. **Consumer domains:** `PUBLIC_DOMAINS` in `domain.js` is a blocklist, easily incomplete. With verification in place this only affects organisation grouping; without it, it is part of the risk above.
4. **Passwords and brute force:** `users` password `min: 8`; PocketBase **rate limiting is disabled by default**; the skeleton enables it through migration `1789495468_security_hardening.js` (Settings > Application > Rate limiting). Check it is still enabled on the instance, with the trusted proxy header set (Settings > Application > User IP proxy headers, e.g. `X-Forwarded-For`), otherwise limits apply to the proxy's IP. Recommend rules for `*:auth`, `*:create` (sign-up), `/oauth/`, `/mcp`, `/api/app/ai/`, `/api/app/keys`.
5. **Superusers:** the console `/_/` is public. Recommend MFA for `_superusers` (collection options in the console), a unique e-mail not used for a member account, and no shared superuser.
6. **OTP and login alerts:** `otp.enabled` and `authAlert.enabled` are true in `users`: fine, but they need a working e-mail channel.

#### 4c. Personal API keys (`ak_`)

In `mcp.js`: `createKey` (40 random chars from `$security.randomStringWithAlphabet`, `prefix` = first 10 chars stored in clear, `hash` = SHA-256, `expires` = now + `KEY_DAYS` = 30), `userForKey` (format regex, lookup by hash, expiry check, `last_used` update).
- Keys returned only once (`POST /api/app/keys`); no key logged (`grep -n "logger\|console" pocketbase/pb_hooks`).
- Revocation = deleting the `api_keys` record; test "MCP : une clé révoquée est refusée" exists.
- Expired keys stay in the table (cleanup is a GDPR/hygiene item, LOW).
- The MCP client calls the REST API with `user.newAuthToken()`: the agent never gets a PocketBase token, and rules still apply. Verify `toRecord` forces `organisation` and `author` from the key owner.
- Filters built with string interpolation (`q()` strips `"` and `\`): check every new filter uses `q()` or bound parameters; prefer `pb.filter("title ~ {:w}", { w })` with the SDK.

#### 4d. OAuth 2.1 (`oauth.js`, `oauth.pb.js`)

- **PKCE:** `S256` mandatory at `/oauth/authorize`, `code_challenge` required at `/oauth/approve`, verified at `/oauth/token` (`pkceOk`). Codes are single-use (`consumeCode` removes before checking) and expire after `CODE_TTL_S` (600 s). Test exists.
- **redirect_uri:** `isRedirectOk` accepts any `https://` URL or `http://localhost|127.0.0.1`; `checkClient` requires an exact match with the registered list. At `/oauth/token`, `client_id` and `redirect_uri` are only compared **if provided** (OAuth 2.1 expects them): MEDIUM.
- **Dynamic registration is anonymous:** anyone can register a client with any name and redirect. The consent page (`authorizePage`) shows `client.name` but **not the redirect host**, so a phishing client named "Claude" can obtain a 30-day key if a member clicks "Autoriser": MEDIUM. Fix: display the redirect host on the consent page; rate-limit `/oauth/register`; optionally purge old unused clients.
- **Consent page:** values escaped with `esc()`; `data-params` JSON escaped; the SDK is loaded from jsdelivr (see Step 6c).
- **Scope:** `SCOPE` is informational; the issued token is a full-rights personal key. Say so in the report (LOW).
- Codes live in `app.store()` (memory): lost on restart, fine for a single instance.

#### 4e. AI relay (`ai.js`, `ai.pb.js`)

- Keys never reach the client: `resolveConfig` reads `organisations.ai_api_key` (hidden, not writable by members) then `APP_AI_*`. `GET /api/app/ai/config` returns no key. Verify no new route returns `cfg`.
- **Cost abuse (MEDIUM/HIGH):** any member can call `/api/app/ai/dictate` (25 MB audio), `/extract` (20 000 chars) and `/realtime/session` without quota. Recommend PocketBase rate-limit rules on `/api/app/ai/` and provider-side spending limits.
- **Realtime ephemeral token:** `createRealtimeSession` returns `client_secret` to the browser; the browser can reuse it for its own session (instructions can be changed with `session.update`) until it expires. Acceptable by design; note it (LOW) and keep the lifetime short.
- **Prompt injection:** the transcript is user content; the extracted draft is only pre-filled in the form, never published automatically. Keep it that way.
- `APP_AI_BASE_URL` comes from the environment only (no SSRF from requests).

#### 4f. Anonymous stats (`stats.pb.js`)

- No auth; `days` clamped to 7..90; `LIMIT 5000`; response cached `public, max-age=300`.
- Only daily counts, the number of organisations with a verified member and the top tags of a day **used by at least 3 distinct organisations** (`MIN_ORGS`). Check nothing else leaks (titles, authors, organisation names): the two "activité publique" tests assert it.
- Residual risks (LOW/MEDIUM): tags are free text written by members and become public; with few organisations, daily counts reveal one team's activity; the organisation count discloses the number of customers.

#### 4g. Discovery documents and base URL

`baseURL` (`mcp.js`) uses Settings > Application URL, but falls back to the request `Host` and `X-Forwarded-Proto` when it is empty or localhost: an attacker-controlled Host can then appear in `/llms.txt`, `/.well-known/*` and OAuth metadata (LOW). Fix: set the Application URL in the console (PocketBase default is `http://localhost:8090`).

### Step 5: Input handling and XSS (Category 2)

- **Interface:** `web/index.html` builds HTML with template strings and `innerHTML` / `insertAdjacentHTML`. `grep -n "innerHTML\|insertAdjacentHTML" web/index.html` and check every `${...}` in those templates is either escaped with `esc()`, a number, or a PocketBase id (`[a-z0-9]{15}`). Functions to review: `renderFeed`, `loadComments`, `renderLeaderboard`, `loadOrgCard`, `loadActivity`, `renderTagCloud`, `loadKeys`, `liveLog`, `sendDictation`, `setNewMode`. Any unescaped member content is HIGH.
- **E-mails:** `notify.js` `layout` inserts `o.intro` and `o.body` raw; check they are built only from `esc()`-ed values (`renderItemEmail`, `renderCommentEmail`).
- **OAuth page:** `authorizePage` escapes with `esc()`.
- **Server validation:** field limits in `pb_schema.json` (`max` on every text field, `maxSize` on json); `normalizeTags` bounds tags.
- **Filters:** see 4c.
- **File fields:** `users.avatar` accepts `image/svg+xml` with `protected: false` (public URL). An SVG can carry script; PocketBase serves files with a restrictive sandbox `Content-Security-Policy`, so verify it on the instance (`curl -sI $TARGET_URL/api/files/_pb_users_auth_/<id>/<file>.svg`) and check any new file field the same way. LOW if the header is present; otherwise MEDIUM, remove SVG from `mimeTypes` unless needed.

### Step 6: HTTP headers, CORS and third-party scripts (Category 3)

#### 6a. Security headers

If `$TARGET_URL` is reachable:

```bash
curl -sI $TARGET_URL/ | grep -iE 'strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy|cross-origin|server|x-powered-by'
curl -sI $TARGET_URL/api/health | grep -iE 'strict-transport|content-security|x-frame|x-content-type|referrer-policy'
```

PocketBase already sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection` and `Cross-Origin-Opener-Policy: same-origin` on static files. Missing by default: `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`.

| Header | Expected | Purpose |
|--------|----------|---------|
| `Strict-Transport-Security` | `max-age=31536000` (start lower) | Forces HTTPS |
| `Content-Security-Policy` | project-specific (below) | Limits injected scripts |
| `X-Frame-Options` / `frame-ancestors` | `SAMEORIGIN` or `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | `camera=(), geolocation=(), microphone=(self)` | The voice capture needs the microphone: never block `microphone` for `self` while AI is kept |

**Where to set them: on the proxy**, not in the app, so the console `/_/` and the API get them too.
- **GitHub + Traefik path:** labels in `infra/deploy/overlays/{dev,prod}/docker-compose.override.yml`, e.g. `traefik.http.middlewares.app-headers.headers.stsSeconds`, `...headers.contentTypeNosniff`, `...headers.referrerPolicy`, `...headers.permissionsPolicy`, `...headers.contentSecurityPolicy`, then append `app-headers` to `traefik.http.routers.app.middlewares`.
- **Coolify path:** Coolify's proxy is Traefik (or Caddy): add the equivalent headers middleware in the resource's container labels or the proxy dynamic configuration, attached to the router Coolify generated for the `app` service. Read the current labels in Coolify first.
- Alternative that works on both paths: a PocketBase `routerUse` hook setting headers. Note it in the report as an option; it also affects `/_/`, so test the console afterwards.

#### 6b. Content Security Policy

Starter policy to adapt (inventory first):
- `default-src 'self'`
- `script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'` (inline scripts in `web/index.html` and in `authorizePage`; replace with hashes to drop `unsafe-inline`)
- `style-src 'self' 'unsafe-inline'` (inline `<style>` and `style=` attributes)
- `img-src 'self' data: blob:`
- `connect-src 'self' https://api.openai.com` (realtime `calls_url` from the browser; plus `APP_AI_BASE_URL` host if overridden)
- `media-src 'self' blob:` (realtime audio)
- `frame-ancestors 'self'`
- The console `/_/` needs its own allowances: test it.

#### 6c. PocketBase SDK from jsdelivr without SRI

`web/index.html` and `authorizePage` (`oauth.js`) load `https://cdn.jsdelivr.net/npm/pocketbase@<version>/dist/pocketbase.umd.js` without `integrity`. A compromised CDN file could read the session token stored in `localStorage` (MEDIUM). Fixes: self-host the file in `web/` and load `/pocketbase.umd.js` (⚠️ Caution: remember to update it with the SDK version), or add `integrity` + `crossorigin="anonymous"` (hash: `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`). Also check the SDK version is compatible with the PocketBase version (see `start/SKILL.md` Section 7).

#### 6d. CORS

PocketBase answers `Access-Control-Allow-Origin: *` by default (`serve --origins`). Tokens travel in the `Authorization` header (no cookies), which limits the impact, but any site can call the API with a token it obtained. Restricting origins (`--origins=https://{domain}` in the `CMD` of both Dockerfiles) is 🚫 Risky: MCP clients are server-side and unaffected, but browser-based tools would break. LOW/MEDIUM.

### Step 7: Secrets and configuration (Category 4)

- `.gitignore` covers `.local/` (including `.local/env.sh`), `.env`, `.env.*` except the committed overlays, `infra/deploy/overlays/*/.env.secrets`, `*.merged`.
- Overlays `.env.dev` / `.env.prod` contain only placeholders (`changeme`, empty values).
- Search the history for real secrets: `git log -p --all | grep -nE "ak_[A-Za-z0-9]{40}|sk-[A-Za-z0-9_-]{20,}|xkeysib-[a-f0-9]{20,}"` (personal keys, OpenAI, Brevo) and for `PB_ADMIN_PASSWORD=` values.
- `deploy.yml` writes secrets to `/tmp/.env.secrets` on the runner and to `overlays/<env>/.env.secrets` on the server, then deletes the server copy after `up`: check the deletion step still exists.
- Local test credentials in `scripts/test.sh` (`test@example.com` / `test-password-123`) are for the throwaway instance only: fine.
- Error messages: hooks throw `BadRequestError` / `ApiError` with French messages; check no stack trace, key or provider response body is returned to clients (`mail.pb.js` includes up to 300 chars of the Brevo response in the thrown error: visible to whoever triggered the e-mail, LOW).
- Logs: `app.logger().warn(...)` calls must not include keys or passwords (`notify.js` logs recipient e-mails: GDPR item).

### Step 8: Dependencies and versions (Category 5)

- **PocketBase:** `PB_VERSION` in `Dockerfile` (must equal `infra/docker/app/Dockerfile` and the default in `scripts/pb.sh`). Compare with the latest release and security advisories: `gh api repos/pocketbase/pocketbase/releases/latest --jq .tag_name` and `gh api repos/pocketbase/pocketbase/security-advisories` (or the GitHub page). Security fixes in patch releases: HIGH if missing.
- **JS SDK:** version in the `<script>` tag of `web/index.html`, `authorizePage` and `mcp/package.json`.
- **Local MCP server:** `mcp/package.json` has no lockfile. To audit, copy `mcp/` to a temporary directory, `npm install --package-lock-only`, `npm audit` there (don't add a lockfile to the repository without asking).
- **Base image:** `alpine:3.21`; check it is still supported and rebuild regularly (`docker build --pull`).
- No npm dependency in the app itself (hooks run in PocketBase's JS VM).

### Step 9: Infrastructure (Category 6)

- **Docker image:** runs as root (no `USER`), downloads the PocketBase zip over HTTPS **without checksum verification** (PocketBase publishes `checksums.txt`: MEDIUM, ⚠️ Caution to add), keeps `wget` for the healthcheck, copies only `pb_hooks`, `pb_migrations`, `pb_schema.json` and `web` (no `.local/`, no secrets). Both Dockerfiles identical (checked in `dev.yml`).
- **Volume:** `/pb/pb_data` holds the database, uploaded files, backups and PocketBase's own secrets: host access to the volume = full access.
- **Backups:** S3 backups enabled in Settings > Backups; the bucket is private; `deploy.yml` archives stay on the same server (not an off-site backup).
- **Traefik path:** Traefik has access to `/var/run/docker.sock` (read-only mount); no dashboard exposed; HTTP redirected to HTTPS by the `redirect-to-https` middleware.
- **Coolify path:** no host port exposed in `docker-compose.yaml`; memory limit 512M.

### Step 10: Present the report

```
## Security Audit Report

### Summary
- Total findings: N
- Critical: N | High: N | Medium: N | Low: N
- Access rules: X collections, Y rules, Z without a test
- Delta: [if previous audit] +X new, -Y resolved, Z unchanged

### What's already secure
[e.g. rules enforced by the database for every client (web, MCP, curl), AI keys hidden and resolved server-side, API keys hashed and expiring, PKCE mandatory with single-use codes, raw SQL with bound parameters, output escaped with esc()]

### Findings

#### [CRITICAL] #1 -- Title
- **Category**: [Access control | Sign-up & accounts | API keys | OAuth | AI relay | Public routes | XSS & input | Headers & CSP | Secrets | Dependencies | Infrastructure]
- **Where**: path + concept (rule, hook, function, route)
- **What's wrong**: plain language
- **Why it matters**: attack scenario / real-world impact
- **How to fix**: specific steps (rule, hook, migration, test, proxy config)
- **Evidence**: rule text, code excerpt or probe result (probes run on a throwaway instance)

[CRITICAL > HIGH > MEDIUM > LOW]

### Access Rules Matrix
| Collection | Rule | Value | Intent | Test | Status |
|------------|------|-------|--------|------|--------|

### Route Security Summary
| Route | Auth | Rate limit | Input bounds | Status |
|-------|------|------------|--------------|--------|

### Security Headers Status
| Header | App (local) | Proxy (deployed) | Status |
|--------|-------------|------------------|--------|

### Notes
- Headers on the local instance differ from production (the proxy adds them)
- Attack probes were run on a throwaway instance, never on real data
- This is an automated audit -- it does not replace professional penetration testing
```

### Step 11: Offer to fix

> "Would you like me to fix any of these issues? I can:
> 1. Fix all critical & high issues
> 2. Fix specific issues (tell me which)
> 3. Add the missing tests for access rules
> 4. Prepare the proxy security headers
> 5. No fixes -- I'll keep the report for reference"

**Fix risk assessment -- apply to every finding:**

| Fix type | Risk | Why |
|----------|------|-----|
| Add a test for an existing rule in `tests/api.test.mjs` | ✅ Safe | No behavior change; may reveal a real bug |
| Set Settings > Application URL in the console | ✅ Safe | Fixes links and discovery documents |
| Display the redirect host on the OAuth consent page | ✅ Safe | Additive text |
| Remove `image/svg+xml` from `users.avatar` mime types (with a migration) | ⚠️ Caution | Existing SVG avatars stay but new ones are refused |
| Enable PocketBase rate limiting and set User IP proxy headers | ⚠️ Caution | Wrong proxy header = everyone shares one IP and gets limited together; start with default rules |
| Add `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options` on the proxy | ⚠️ Caution | `Permissions-Policy` must keep `microphone=(self)` while AI is kept |
| Self-host the SDK or add `integrity` | ⚠️ Caution | A wrong hash or a forgotten update blocks the whole interface |
| Verify the PocketBase zip checksum in the Dockerfiles | ⚠️ Caution | A wrong checksum line fails the build (both Dockerfiles must stay identical) |
| Require `client_id` / `redirect_uri` at `/oauth/token` | ⚠️ Caution | A connector that omits them would stop working; check claude.ai / ChatGPT behavior |
| Restore the one-way twin password sync or e-mail verification after a regression | 🚫 Risky | Administrators must know their superuser password; without a working e-mail channel nobody can finish signing up, and existing accounts must be marked verified by a migration |
| Change any access rule in `pb_schema.json` | 🚫 Risky | A too-strict rule empties the feed, a too-loose one leaks data; needs a migration and tests |
| Add `Content-Security-Policy` | 🚫 Risky | **The #1 "fix everything" footgun.** Blocks anything not listed: the jsdelivr SDK, inline scripts and styles of `index.html` and the OAuth page, the OpenAI realtime connection, the console `/_/`. Inventory everything and test every view before enabling |
| Add `Strict-Transport-Security` | 🚫 Risky | Browsers refuse HTTP for the domain for `max-age`; if HTTPS breaks later, the app is unreachable. Start with a short max-age |
| Restrict CORS origins | 🚫 Risky | Breaks any browser-based client on another origin |
| Run the container as non-root | 🚫 Risky | The existing `/pb/pb_data` volume is owned by root: PocketBase can no longer write its database |

**Fix risk gating (same rules as /quality):**
- ✅ Safe: apply directly
- ⚠️ Caution: apply, then summarize what changed
- 🚫 Risky: **STOP after Safe/Caution fixes.** Ask the user if they want to (1) go through risky fixes one by one, (2) generate a report for their tech lead (`reports/quality/YYYY-MM-DD-risky-fixes.md`), or (3) skip entirely. See /quality SKILL.md Step 9 for the full flow.

**When fixing:**
- **Access rules:** edit `pocketbase/pb_schema.json`, add a **new** migration in `pocketbase/pb_migrations/` for existing instances (see the patterns in `.claude/skills/start/guides/`), add or update the test, run `make test`.
- **Hooks:** shared logic in plain `*.js` modules loaded with `require()` inside each handler; hooks reload on the fly locally, environment changes need a restart.
- **Headers:** proxy configuration (Traefik labels in the overlays, or Coolify); document it in `ai/INFRA_PRACTICES.md`.
- **Dockerfiles:** change both identically.

**Fix flow (same as /quality Step 9):**
1. Apply all ✅ Safe and ⚠️ Caution fixes. Update the practice docs (`ai/POCKETBASE_PRACTICES.md`, `ai/MCP_PRACTICES.md`, `ai/AI_PRACTICES.md`, `ai/WEB_PRACTICES.md`, `ai/INFRA_PRACTICES.md`, or `.claude/practices.md`) with the patterns just introduced (e.g. "every rule has a test", rate-limit rules, header middleware, SRI update process).
2. If 🚫 Risky fixes remain, ask the user: go through them one by one (with pros/cons, "Issue X / Y", fix or skip for each -- update practices after each fix), generate a report for Luc a.k.a. the professional fixer, or skip entirely.
3. **Automatically re-run the audit.** Show the delta.

## ARGUMENTS

- No argument: full audit (all categories)
- `--quick`: code-level only (no runtime checks, no probes)
- `--rules-only`: only the access rules matrix and the sign-up / account checks (Step 4)
- `--headers-only`: only check security headers
- `--fix`: skip report, fix all critical & high issues directly (risky fixes still require confirmation)
- `--delta`: only show what changed since last audit

$ARGUMENTS
