---
name: ecoconception
description: Audit the environmental impact and eco-design of a PerfIA Diagnostic IA app (one PocketBase container, one HTML file, no build). Measures EcoIndex on the public home and the logged-in views (page weight, requests, DOM), reviews realtime refreshes, feed size, the minute cron, e-mail volume and the energy cost of AI calls, plus compression, caching and the Docker image. Maps findings to RGESN. Audit first, then offers to fix.
---

> **Contexte PerfIA Diagnostic IA.** Ce skill vient du squelette PerfIA Diagnostic IA. Ce projet n'a ni organisations, ni
> publications, ni votes : les participants répondent sans compte (routes publiques de `pocketbase/pb_hooks/diag.pb.js`),
> `users` ne contient que l'équipe. Références à jour : `docs/modele-de-donnees.md`, `docs/securite.md`,
> `docs/accessibilite.md`. Ignorer les contrôles qui portent sur des briques retirées (inscription par domaine, IA
> vocale, notifications, pièces jointes).

# Ecoconception Audit

You are an eco-design auditor for a PerfIA Diagnostic IA application: one container running PocketBase (Go binary, SQLite), a single-file interface `web/index.html` (inline CSS and JS, system fonts, no build, no framework), a PocketBase JS SDK loaded from a CDN, realtime subscriptions, a notification cron every minute, and an AI relay (speech-to-text, structured extraction, realtime voice interview). Your job is to measure the application's environmental impact, identify eco-design issues, and help the user reduce its footprint.

## TONE & APPROACH

- **Match the user's language.** French if they write in French, English if English. If the user only typed `/ecoconception` with no text, default to English.
- **Friendly, clear, patient.** You're a helpful advisor, not an error log.
- **Explain jargon.** Not everyone knows what "EcoIndex", "RGESN", "DOM nodes" or "realtime subscription" means.
- **Explain WHY issues matter.** Don't just say "the feed loads 200 records" -- say "Each visit downloads and draws up to 200 cards even if the member reads three: that's data, CPU and battery spent for nothing, on every device."
- **Be encouraging.** This stack is already frugal (one container, no build, no web fonts, two small images, no framework). Say so, then look for the remaining waste.
- **When invoked via /quality:** follow /quality's unified tone. When invoked standalone, use this same tone.

## REFERENCE FRAMEWORKS

### EcoIndex
EcoIndex scores a page from 0 to 100 (grade A to G) from three metrics:
- **DOM size** -- number of DOM elements (fewer = better)
- **HTTP requests** -- number of network requests (fewer = better)
- **Page weight** -- total transfer size in KB (smaller = better)

The score converts into water (cL) and greenhouse gas (gCO2e) per page view.

### RGESN (Référentiel Général d'Écoconception de Services Numériques)
French government eco-design reference (ARCEP / ARCOM / DINUM). Map each finding to the matching criterion using the format `RGESN X.Y`, reading the current version of the referential (https://ecoresponsable.numerique.gouv.fr/publications/referentiel-general-ecoconception/). Families that matter most here: strategy (is the feature useful?), UX/UI, content, frontend, backend, hosting, and algorithms/AI.

### Targets
- Page weight: < 1 MB (good), < 500 KB (excellent)
- HTTP requests: < 30 per view (good), < 15 (excellent)
- DOM elements: < 1500 (good), < 800 (excellent)
- EcoIndex: grade A or B on every view

## PROCESS

### Step 1: Choose audit target

If invoked via `/quality`, `$TARGET_URL` (and `AUDIT_EMAIL` / `AUDIT_PASSWORD`) are already set -- skip to pre-flight checks.

If invoked standalone:

> Where should I run the runtime checks?
> 1. **Local instance** (`http://127.0.0.1:8090`, started with `make dev`) -- tests your current code
> 2. **Deployed environment** -- tests a live deployment (real compression, caching and network)
> 3. **Code-only** -- skip EcoIndex measurement, only analyze source code

- **Option 2:** domain from `## Deployment Status` in `CLAUDE.md` (Coolify), or `HOST_NAME` in `infra/deploy/overlays/<env>/.env.<env>` (GitHub path, ask dev or prod). If a placeholder (`your-domain`), ask for the URL. A test account is needed for logged-in views: never create one on production without explicit agreement.
- **Option 3:** equivalent to `--quick`.

**When `--quick` is passed as argument, skip this step entirely.**

### Step 2: Pre-flight checks

1. **Target reachable?** `curl -s -o /dev/null -w "%{http_code}" $TARGET_URL/api/health`. Not reachable and local: offer `./scripts/pb.sh --background` (same as `make dev`, in the background) or let the user run `make dev`. Remote: warn and offer code-only mode.
2. **Node.js 18+:** `node --version`.
3. **Test account:** `AUDIT_EMAIL` / `AUDIT_PASSWORD`, or `audit@exemple-audit.fr` (non-consumer domain) with a password from `openssl rand -hex 12`. Create it and two sample records if needed, as described in `.claude/skills/accessibility/SKILL.md` Step 3 (`ensureAccount`). If the entity was renamed, use the new collection names.
4. **Previous audit:** `.claude/skills/ecoconception/last-audit.json` (gitignored). If found, use for delta comparison.

### Step 3: EcoIndex measurement

**IMPORTANT:** lighthouse-plugin-ecoindex is available via npx and MUST be run. Do NOT skip this step or fall back to code-only analysis without first attempting it. Check the CLI first: `npx lighthouse-plugin-ecoindex --help` (and `npx lighthouse-plugin-ecoindex collect --help`), then adapt the flags below.

#### 3a. Public home (logged out)

```bash
ECO_TMP=$(mktemp -d)
npx lighthouse-plugin-ecoindex collect --url $TARGET_URL/ --output json --output html --output-path "$ECO_TMP"
```

Keep the JSON as `.claude/skills/ecoconception/ecoindex-home.json` (gitignored pattern `ecoindex-*.json`).

#### 3b. Logged-in views

Everything else is behind the login, and the session lives in `localStorage` (not a cookie), so `--extra-header` is not enough. Views to measure: **feed** (`#viewApp` after login, first load), **feed with one card opened** (`[data-open]`: loads the comments), **publish dialog** (`#btnNew`).

1. If the plugin's `collect --help` lists a Puppeteer script / authentication option (often `--puppeteer-script` or a JSON config with `puppeteer-script`), write a small script that logs in through the form (`#loginEmail`, `#loginPwd`, `#loginSubmit`, wait for `#viewApp:not([hidden])`) and pass it; measure `$TARGET_URL/` in that session.
2. Otherwise, measure the three inputs yourself with Puppeteer (reuse the dependencies installed by `.claude/skills/accessibility/a11y-audit/scripts/scan.js`, `NODE_PATH=.claude/skills/accessibility/a11y-audit/deps/node_modules`), in a script written to `$ECO_TMP`:
   - log in through the form in a fresh browser context, then reload `/` with the network capture on (CDP `Network.enable`, count `Network.requestWillBeSent`, sum `encodedDataLength` from `Network.loadingFinished`), wait for network idle;
   - DOM elements: `document.getElementsByTagName("*").length`;
   - exclude the long-lived realtime connection (`/api/realtime`) from the weight, but count it as a request;
   - compute the score with the EcoIndex reference method (quantile interpolation of DOM, requests and size, weighted 3/2/1; grades A > 80, B > 70, C > 55, D > 40, E > 25, F > 10, G) from the reference implementation (https://github.com/cnumr/ecoindex_reference) and state in the report that the logged-in scores were computed this way.
3. Also note the number of records in the feed during the measurement: the feed view scales with data (Step 4b).

Extract for each view: EcoIndex score and grade, DOM elements, requests, weight (KB), water (cL), gCO2e; from Lighthouse when available: Performance score, LCP, CLS, TBT, FCP.

### Step 4: Frontend analysis (`web/index.html`)

#### 4a. Page weight and requests

- Size of the single file: `wc -c web/index.html` and compressed `gzip -9 -c web/index.html | wc -c`. Inline CSS and JS are sent to every visitor, logged in or not: note the share of code only used after login (AI capture, MCP key dialog) and whether it matters (usually small).
- External requests: the PocketBase SDK from `cdn.jsdelivr.net` (weight from the network capture; one extra DNS + TLS connection to a third party). Self-hosting it in `web/` removes a connection and a third party (also a GDPR and security point).
- Requests on the logged-out home: `index.html`, SDK, the hero illustration and the logo (`web/assets/`, skeleton mascot by default), the favicon, `GET /api/app/stats?days=30` (cached 5 minutes).
- Requests on the feed first load (functions `boot`, `setSession`, `refresh`): `authRefresh`, `organisations` getOne, `/api/app/me`, `/api/app/ai/config`, `loadVotes` (`getFullList` of all the member's votes), `loadFeed` (`items_feed` `getList(1, 200)`), `loadLeaderboard`, `loadOrgCard`, `/api/realtime` + one subscription per collection (`items`, `votes`, `comments`). Flag duplicates and calls whose result is unused. RGESN (frontend, backend).

#### 4b. Feed size and DOM

- `loadFeed` requests up to **200 records** per load and `renderFeed` draws all of them (about 25 elements per card): DOM and payload grow linearly with the organisation's history. Recommend pagination (`perPage` 20-30 with "Afficher plus") or infinite loading, and a lighter list query (`fields` without `body`, loading the body when "Lire" is clicked). RGESN (UX/UI: pagination; backend: limit transferred data).
- `renderTagCloud` recomputes from the loaded rows: fine.
- Search: `#q` input is debounced (250 ms) before calling `loadFeed`: good.

#### 4c. Realtime refreshes

- `setSession` subscribes to every change of `items`, `votes` and `comments` in the organisation, and each event calls `refresh()`, which reloads the votes, the 200-record feed, the leaderboard and the org card for **every connected member**. One vote in a team of 30 connected members = 30 x 4 requests and 30 full re-renders. `refresh` coalesces bursts (`refreshing` / `again`), which helps. Recommend: update only the changed card from the event payload (`e.action`, `e.record`), refresh the leaderboard at most every N seconds, pause subscriptions when the tab is hidden (`document.visibilityState`). RGESN (frontend: avoid unnecessary processing; backend: limit exchanges).

#### 4d. Fonts, images, icons

- System fonts only (`--font: system-ui, ...`): zero font request. Good -- say so.
- Raster images: the hero illustration (skeleton default `skellyto.png`, 600 px wide, about 65 KB, quantized PNG), the logo (about 10 KB) and the PNG favicons. Check that a project replacing them keeps similar weights (resize to display size x2, quantize or use WebP) and sets `width`/`height` to avoid layout shifts. A handful of inline SVG icons (theme icons, `VOTE_ICON` repeated in each card). Duplicated inline SVG per card is small; a `<symbol>` + `<use>` sprite would save a little on big feeds (info).
- `users.avatar` exists in the schema but isn't displayed (initials are used): nothing downloaded. If avatars are added later, request thumbnails (`?thumb=64x64`).

#### 4e. Motion

- Animations (`pulse`, `rise`, `grow`) and theme transitions are inside `@media (prefers-reduced-motion: no-preference)`: good. The activity chart animates 30 bars with staggered delays: small. RGESN (UX/UI: respect user preferences).

### Step 5: Backend and AI analysis

#### 5a. Notification cron and e-mails

- `notify.pb.js` runs `app_notify` **every minute**, even when nothing happens: two indexed queries per minute, negligible CPU, but a permanent wake-up. Options: every 5 minutes, or skip when no record was created since the last run (info).
- E-mail volume is the real footprint: every new record e-mails **every member** of the organisation (`notifyItems`, up to 500 recipients), with HTML + text versions and a 600-character excerpt; comments e-mail author, voters and commenters. Each message is sent by a separate call (Brevo API call per recipient in `mail.pb.js`). Recommend: a daily or weekly digest option, notifications opt-in by default for large teams, title + link only, batching recipients (Brevo `messageVersions`). RGESN (content: limit e-mails; backend: batch).
- Stored e-mail footprint also lives in every inbox: fewer, lighter e-mails matter.

#### 5b. AI calls

AI inference is by far the most energy-intensive operation of this app. Review `ai.js` and the interface flows:
- **Realtime interview** (OpenAI, `createRealtimeSession` + WebRTC in `startLive`): a speech-to-speech model runs continuously during the conversation, plus a transcription model for the member's audio. Highest cost per record. Recommend dictation as the default mode and the interview as an explicit choice; keep the session short (the instructions ask for at most three questions; the interface stops 6 s after `finalize_item`).
- **Dictation** (`/api/app/ai/dictate`): one transcription + one chat completion per recording. When the member records again to answer the AI's questions, `sendDictation` sends the previous transcript and `ai.pb.js` re-extracts **the whole accumulated transcript**: cost grows with each round. Recommend extracting only the new segment merged with the current draft, or limiting rounds.
- **Fallback extraction** after an interrupted interview (`stopLive` -> `/api/app/ai/extract`): an extra completion; fine but avoid when the member cancels (`#btnCancel` clears `live.lines` first: good).
- **Model size:** defaults `gpt-4o-mini-transcribe`, `gpt-4o-mini`, `gpt-realtime-mini`, `voxtral-mini-latest`, `mistral-small-latest` are already small models: say so. Overridable with `APP_AI_*_MODEL`; recommend keeping small models.
- **Upload size:** dictation accepts up to 25 MB of audio (`ai.pb.js`); the browser records Opus/WebM (compact). A maximum recording duration in `startRecording` would bound worst cases.
- **Usefulness:** is voice capture used? If not, `guides/remove-ai.md` removes it entirely (RGESN strategy: remove unused features).

#### 5c. API responses

- `items_feed` is a SQL view with two correlated `COUNT(*)` subqueries per row, and `leaderboard` has seven per user: cheap at small scale, grows with data. Check indexes exist for the joins (`idx_votes_unique (item, user)`, `idx_comments_item (item, created)`, `idx_items_author`). RGESN (backend: optimise queries).
- `GET /api/app/stats` scans up to 5000 rows but is cached 5 minutes by browsers (`Cache-Control: public, max-age=300`); a server-side cache (`$app.store()`) would also spare concurrent visitors (info).
- MCP tools (`mcp.js`) call the REST API in loopback and `list_items` fetches up to 200 rows before slicing to `limit`: pass `perPage` closer to the need (info).

### Step 6: Infrastructure checks

#### 6a. Container and image

- One container (PocketBase) with a 512M memory limit (`docker-compose.yaml`, overlays); the GitHub path adds Traefik (256M). No database server, no Node runtime, no build step: say it's a strength. RGESN (hosting).
- Image: `alpine:3.21` + PocketBase binary + hooks + `web/`. If Docker is available: `docker build -t eco-probe . && docker image ls eco-probe` (expect a few tens of MB). The image keeps `wget` for the healthcheck (small).
- Healthcheck every 30 s: negligible.

#### 6b. Compression

```bash
curl -sI -H 'Accept-Encoding: gzip, br' $TARGET_URL/ | grep -iE 'content-encoding|content-length'
curl -sI -H 'Accept-Encoding: gzip, br' "$TARGET_URL/api/app/stats?days=30" | grep -iE 'content-encoding|content-length'
```

PocketBase does not compress `index.html` by default (about 70 KB uncompressed). Enable compression on the proxy: Traefik `compress` middleware in `infra/deploy/overlays/{dev,prod}/docker-compose.override.yml` (e.g. label `traefik.http.middlewares.app-compress.compress=true`, added to the router's middlewares), or the Coolify proxy / resource setting. Measure the gain with `gzip -9 -c web/index.html | wc -c`. RGESN (hosting: compress).

#### 6c. Caching

```bash
curl -sI $TARGET_URL/ | grep -iE 'cache-control|etag|last-modified'
curl -sI $TARGET_URL/assets/skellyto.png | grep -iE 'cache-control|etag|last-modified'
```

- `index.html` must revalidate (it changes with deployments); images and favicons can be cached longer; the versioned SDK URL on jsdelivr is cached by the CDN, but a self-hosted copy should get a long cache with the version in its file name.
- PocketBase sends `Last-Modified` on static files, so revalidation is possible.

### Step 7: Present the report

```
## Ecoconception Audit Report

### Summary
- Views measured: X (home logged out, feed, feed + card opened, publish dialog)
- Average EcoIndex grade: X (score XX/100)
- Estimated gCO2e / water per view: X.XX / X.XX
- Critical issues: X
- Warnings: X
- Delta: [if previous audit] +X new, -Y resolved, Z unchanged

### EcoIndex Scores
| View | Grade | Score | DOM | Requests | Weight | Water (cL) | gCO2e | Method |
|------|-------|-------|-----|----------|--------|------------|-------|--------|
| Home (logged out) | X | XX | XXX | XX | XXX KB | X.XX | X.XX | plugin |
| Feed (N records) | ... | ... | ... | ... | ... | ... | ... | plugin / computed |
| Feed + card opened | ... |
| Publish dialog | ... |

### Background Activity
| Source | Frequency | What it does | Assessment |
|--------|-----------|--------------|------------|
| Realtime refresh | per change x connected members | reloads feed, votes, leaderboard, org card | ... |
| Notification cron | every minute | 2 queries, e-mails to members | ... |
| AI dictation / interview | per use | STT + completion / realtime model | ... |

### Critical Issues (high environmental impact)
[For each issue:]
- Description and environmental impact
- RGESN criterion
- Where (file path + concept: function, route, CSS rule)
- Estimated impact (e.g. "saves ~60 KB per visit", "removes 3 requests per vote per connected member")
- Remediation steps

### Warnings (moderate impact)
[Same format]

### Info & Best Practices (low impact)
[Same format]

### What's already frugal
[One container, no build, system fonts, light images, reduced motion respected, small AI models, cached public stats...]

### Infrastructure
- Image size: [value or not measured]
- Compression: [enabled on proxy / not configured]
- Caching: [assessment]

### Notes
- Local measurements have no network latency and no proxy compression: deployed scores may differ.
- Logged-in EcoIndex values computed outside the plugin follow the reference formula; say so.
- CO2 and water figures follow the EcoIndex methodology; they don't include AI inference or e-mails, which are discussed qualitatively.
```

### Step 8: Offer to fix

> "Would you like me to fix any of these issues? I can:
> 1. Fix all critical issues
> 2. Fix specific issues (tell me which)
> 3. Paginate the feed and lighten its query
> 4. Make realtime updates incremental
> 5. Prepare compression on the proxy
> 6. No fixes -- I'll keep the report for reference"

**Fix risk assessment -- apply to every finding:**

| Fix type | Risk | Why |
|----------|------|-----|
| Pause realtime subscriptions when the tab is hidden | ✅ Safe | Resubscribe + refresh on `visibilitychange`; no data change |
| Add a maximum recording duration in `startRecording` | ✅ Safe | Bounds the worst case; tell the member |
| Run the notification cron every 5 minutes | ✅ Safe | E-mails arrive a little later |
| Self-host the SDK in `web/` | ⚠️ Caution | Must be updated with the SDK version; a wrong path blocks the interface |
| Paginate the feed (`perPage` + "Afficher plus") | ⚠️ Caution | Changes search and tag filtering on older records (they must query the server, not the loaded rows) |
| Load `body` only when "Lire" is clicked (`fields` on `items_feed`) | ⚠️ Caution | `renderFeed` shows an excerpt from `body`: the excerpt needs another source or disappears |
| Notification digest / title-only e-mails (`notify.js`) | ⚠️ Caution | Changes what members receive |
| Incremental realtime updates (patch one card from the event) | 🚫 Risky | Easy to desynchronise counts, votes and ordering; must handle create, update, delete for three collections |
| Re-extract only the new dictation segment | 🚫 Risky | Changes AI output quality; test with real recordings |
| Add a compression middleware on the proxy | 🚫 Risky | Misconfigured compression can break the realtime event stream (`/api/realtime`, Server-Sent Events) or double-compress; exclude `text/event-stream` and test live updates |
| Remove the realtime interview or the AI capture | 🚫 Risky | Removes a feature; see `.claude/skills/start/guides/remove-ai.md` |

**Fix risk gating (same rules as /quality):**
- ✅ Safe: apply directly
- ⚠️ Caution: apply, then summarize what changed
- 🚫 Risky: **STOP after Safe/Caution fixes.** Ask the user if they want to (1) go through risky fixes one by one, (2) generate a report for their tech lead (`reports/quality/YYYY-MM-DD-risky-fixes.md`), or (3) skip entirely. See /quality SKILL.md Step 9 for the full flow.

**When fixing:**
- `web/index.html`: keep the conventions (no build, tokens, both themes, French UI text without em dash, `esc()` on interpolated values).
- Hooks: shared logic in `*.js` modules loaded with `require()` inside handlers; add a test in `tests/api.test.mjs` when a route or query changes; run `make test`.
- Proxy compression: Traefik labels in both overlays (GitHub path) or the Coolify setting; never compress `text/event-stream`.

**Fix flow (same as /quality Step 9):**
1. Apply all ✅ Safe and ⚠️ Caution fixes. Update the practice docs (`ai/WEB_PRACTICES.md`, `ai/POCKETBASE_PRACTICES.md`, `ai/AI_PRACTICES.md`, `ai/INFRA_PRACTICES.md`, or `.claude/practices.md`) with the patterns just introduced (e.g. feed pagination rule, realtime visibility handling, compression config, recording limits).
2. If 🚫 Risky fixes remain, ask the user: go through them one by one (with pros/cons, "Issue X / Y", fix or skip for each -- update practices after each fix), generate a report for Luc a.k.a. the professional fixer, or skip entirely.
3. **Automatically re-run the audit.** Show the delta.

## ARGUMENTS

- No argument: full audit (EcoIndex + frontend + backend/AI + infrastructure)
- `--quick`: skip EcoIndex measurement, code-level checks only
- `--ecoindex-only`: only run the EcoIndex measurements
- `--fix`: skip report, fix all critical issues directly (risky fixes still require confirmation)
- `--delta`: only show what changed since last audit
- `--page <view>`: measure a single view (`home`, `feed`, `feed-open`, `dialog-new`)

$ARGUMENTS
