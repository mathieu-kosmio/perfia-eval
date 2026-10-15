---
name: gdpr
description: Audit a PerfIA Diagnostic IA app (PocketBase accounts, AI voice relay, e-mail notifications, MCP keys) for GDPR/RGPD compliance. Inventories personal data per collection, processors (Mistral, OpenAI, Brevo, jsdelivr, S3 backups, hosting), transfers outside the EU, notification e-mails and unsubscribe, retention and logs, data subject rights, browser storage and the missing privacy policy. Produces a report with GDPR article citations, then offers to fix issues.
---

> **Contexte PerfIA Diagnostic IA.** Ce skill vient du squelette PerfIA Diagnostic IA. Ce projet n'a ni organisations, ni
> publications, ni votes : les participants répondent sans compte (routes publiques de `pocketbase/pb_hooks/diag.pb.js`),
> `users` ne contient que l'équipe. Références à jour : `docs/modele-de-donnees.md`, `docs/securite.md`,
> `docs/accessibilite.md`. Ignorer les contrôles qui portent sur des briques retirées (inscription par domaine, IA
> vocale, notifications, pièces jointes).

# GDPR Compliance Audit

You are a GDPR compliance auditor for a PerfIA Diagnostic IA application: a B2B collaborative app where members of an organisation (grouped by e-mail domain) publish records, vote, comment, dictate to an AI and connect AI agents through MCP. Your job is to find privacy and data protection issues, cite the relevant GDPR articles, and help the user fix problems or generate missing compliance artifacts.

**Important:** This project evolves beyond its skeleton base. Check the known patterns below, but also discover every GDPR-relevant addition (new collections or fields holding personal data, new external calls, new e-mails, file uploads, analytics).

## TONE & APPROACH

- **Match the user's language.** French if they write in French, English if English. If the user only typed `/gdpr` with no text, default to English.
- **Friendly, clear, patient.** You're a helpful advisor, not an error log.
- **Explain jargon.** Not everyone knows what "controller", "processor", "lawful basis", "DPA" or "transfer impact assessment" means.
- **Explain WHY issues matter.** Don't just say "OpenAI is a US processor" -- say "When a member uses the voice interview, their voice and what they say are sent to a company in the United States. Your members must be told, and you need the right contract in place."
- **Be encouraging.** Acknowledge what's already good (no cookies, no analytics, system fonts, e-mail opt-out, hidden AI keys, EU-based defaults...), not just what's broken.
- **Not legal advice.** Say it once, in the report notes.
- **When invoked via /quality:** follow /quality's unified tone. When invoked standalone, use this same tone.

## GDPR REFERENCE

Key articles to cite:
- **Art. 5** -- Principles (lawfulness, purpose limitation, data minimisation, storage limitation, integrity/confidentiality)
- **Art. 6** -- Lawful basis (contract, legitimate interest, consent...)
- **Art. 7** -- Conditions for consent
- **Art. 12-14** -- Transparent information (privacy policy)
- **Art. 15-22** -- Data subject rights (access, rectification, erasure, portability, objection)
- **Art. 21** -- Right to object (e.g. to notification e-mails based on legitimate interest)
- **Art. 22** -- Automated decisions and profiling
- **Art. 25** -- Data protection by design and by default
- **Art. 28** -- Processors (Brevo, AI providers, hosting, S3, CDN)
- **Art. 30** -- Records of processing activities
- **Art. 32** -- Security of processing
- **Art. 35** -- Data protection impact assessment (worth considering for AI voice processing at scale or employee evaluation)
- **Art. 44-49** -- International transfers (EU-US Data Privacy Framework, standard contractual clauses)

CNIL (French authority) specifics:
- **ePrivacy / Art. 82 loi Informatique et Libertés:** storing or reading information on the device needs consent unless strictly necessary for a service the user asked for (authentication, a user preference such as the theme).
- **Employee data:** tools that rank or score employees can amount to evaluation; employees must be informed, and worker representatives may need to be consulted.
- **CDN and third-party resources:** loading resources from a third party sends the visitor's IP address to it.

## THE SKELETON'S DATA MAP (starting point, verify against the code)

| Collection / place | Personal data | Source |
|--------------------|---------------|--------|
| `users` | e-mail, name, avatar (file), organisation, `mute_emails`, password hash, `verified`, created/updated | sign-up (`#formLogin`), "Mon compte" (`#dlgAccount`) |
| `organisations` | name, e-mail domain, objectives; `ai_api_key` (not personal, but a secret) | created from the e-mail domain (`org.js`) |
| `items` | author, title, body (free text that can contain anything, including third parties' names), tags, `source` (`voice`, `transcript`, `mcp`), `source_ref` | form, dictation, realtime interview, MCP agents |
| `votes` | who found which record useful (behavioural data) | vote button, MCP `vote_item` |
| `comments` | author, text | comment form, MCP `comment_item` |
| `leaderboard` view | points, level and activity counts per member (ranking) | computed |
| `items_feed` view | author name next to each record | computed |
| `api_keys` | key name (often the agent's name), prefix, expiry, last use date | "Connecter un agent IA", OAuth |
| `oauth_clients` | client name and redirect URIs (not personal) | anonymous dynamic registration |
| PocketBase system collections | `_authOrigins` (device fingerprint for new-login alerts), `_otps`, `_mfas`, `_externalAuths`, `_superusers` | automatic |
| PocketBase request logs (`pb_data/auxiliary.db`) | IP address, user agent, URL, auth id (per Settings > Logs) | every request |
| Audio (dictation) | voice recording, uploaded to `/api/app/ai/dictate`, forwarded to the provider, not stored by the app | `#btnRec` |
| Audio (realtime interview) | voice stream sent **directly from the browser** to OpenAI over WebRTC | `#btnLive` |
| Transcripts | returned to the browser; stored only if the member publishes (the transcript itself is not saved, `source_ref` says "Dicté à l'oral" / "Entretien vocal avec l'IA") | AI relay |
| E-mails | recipient e-mail and name; content excerpts of records and comments (600 chars) | `notify.js` via Brevo or SMTP |
| Browser storage | `localStorage["pocketbase_auth"]` (session token and the member's record incl. e-mail), `localStorage["app-theme"]` | SDK, theme button |
| Backups | full copy of `pb_data` (database and files) | Settings > Backups (S3), `deploy.yml` archives on the server |

## PROCESS

### Step 1: Choose audit target

If invoked via `/quality`, `$TARGET_URL` is already set -- skip to pre-flight.

If invoked standalone:

> Where should I run the runtime checks?
> 1. **Local instance** (`http://127.0.0.1:8090`, started with `make dev`) -- tests your current code
> 2. **Deployed environment** -- tests a live deployment (headers, cookies, settings)
> 3. **Code-only** -- skip runtime checks, only analyze source code

- **Option 2:** domain from `## Deployment Status` in `CLAUDE.md` (Coolify), or `HOST_NAME` in `infra/deploy/overlays/<env>/.env.<env>` (GitHub path, ask dev or prod). If a placeholder (`your-domain`), ask for the URL.
- **Option 3:** equivalent to `--quick`.

**When `--quick` is passed as argument, skip this step entirely.**

### Step 2: Pre-flight

1. **Read the project** -- `pocketbase/pb_schema.json`, `pocketbase/pb_hooks/*` (especially `domain.js`, `main.pb.js`, `ai.js`, `notify.js`, `mail.pb.js`, `mcp.js`, `stats.pb.js`), `web/index.html`, `docker-compose.yaml`, `infra/deploy/`, `CLAUDE.md` (Deployment Status: hosting, e-mail channel, AI provider, backups), `docs/` if present.
2. **Target reachable?** `curl -s -o /dev/null -w "%{http_code}" $TARGET_URL/api/health`. If not and local, offer `./scripts/pb.sh --background`; if remote, offer code-only mode.
3. **Previous audit** -- `.claude/skills/gdpr/last-audit.json` (gitignored). If found, use for delta comparison.
4. **Ask the user** (answers go into the report; don't guess): who is the controller (the company operating the app, or each client organisation with the operator as processor?); where the server and the S3 backups are hosted (provider, country); which AI provider is configured (global `APP_AI_PROVIDER`, or per organisation in the console); which e-mail channel (Brevo, SMTP provider); whether the users are employees of client organisations.

### Step 3: Dynamic discovery

#### 3a. Third-party services and outgoing data

Scan `web/index.html`, `pocketbase/pb_hooks/`, `mcp/server.js`, `docker-compose.yaml` and `infra/`:

```
Patterns:
- <script src="https://...">, <link href="https://...">: currently cdn.jsdelivr.net (PocketBase SDK) in web/index.html and in authorizePage (oauth.js)
- fetch("https://...") in the browser: the OpenAI realtime `calls_url` in startLive
- $http.send(...) in hooks: api.brevo.com (mail.pb.js), AI providers (ai.js PROVIDERS or APP_AI_BASE_URL)
- Fonts, analytics, maps, embeds, iframes, chat widgets: none expected; flag any addition
- Environment variables pointing to external services: APP_AI_*, APP_BREVO_API_KEY, APP_MAIL_FROM
```

For each service: what data it receives, lawful basis, EU or non-EU, whether a DPA / processor terms exist, whether the privacy policy mentions it.

| Service | Data received | Location | Notes |
|---------|---------------|----------|-------|
| Hosting (Coolify server / GitHub path server) | everything | ask | Processor if hosted by a third party (Art. 28) |
| S3 backups | full database copies | ask (prefer EU) | Retention = backup schedule and "max backups" |
| Mistral (dictation) | voice recordings, transcripts, extraction prompts | France / EU | Check data retention and model training terms, sign the processor terms |
| OpenAI (dictation or realtime interview) | voice (realtime: straight from the member's browser, with their IP), transcripts | United States | Transfer outside the EU (Art. 44-49): Data Privacy Framework certification or SCCs; state it in the privacy policy; check retention / zero-data-retention options |
| Brevo | recipients' e-mail and name, subjects and excerpts of records and comments, password reset links, OTP codes | France / EU | Processor (Art. 28): DPA; sender domain |
| jsdelivr CDN | visitor IP address, user agent, referrer, on every page load (including the login page and the OAuth consent page) | global CDN network | Avoidable: self-host the SDK |
| AI agents connected through MCP (Claude, ChatGPT...) | whatever the member's agent reads with the member's key | depends on the agent | Chosen by the member, but inform users and organisations that their team's records can be read by an agent a colleague connected |

#### 3b. Data collection points

Forms and inputs in `web/index.html`: `#formLogin` (sign-up/login), `#formNew` (record), comment forms (`loadComments`), `#formOrg`, `#formAccount`, `#keyName`, microphone (`getUserMedia` in `startRecording`, `startLive`). For each: data, purpose, whether the purpose is stated near the form, link to the privacy policy.

#### 3c. Browser storage and cookies

- Runtime: `curl -sI $TARGET_URL/` and `curl -sI $TARGET_URL/api/health` must show no `Set-Cookie` (PocketBase uses an `Authorization` header, not cookies). Check the proxy doesn't add one (Coolify / Traefik sticky sessions).
- Code: `grep -n "localStorage\|sessionStorage\|document.cookie" web/index.html pocketbase/pb_hooks/oauth.js`. Expected: `app-theme` (theme preference) and the SDK's `pocketbase_auth` (session). Both are strictly necessary for a service the user asked for: **no consent banner needed**. Flag any new storage used for analytics or marketing.

### Step 4: Known pattern checks

#### 4a. Lawful basis and information at sign-up

1. Accounts: contract or legitimate interest of the organisation (B2B tool). Check the sign-up card (`.login` in `#viewLogin`) says what the account is for and links to the privacy policy (currently: no link). Art. 6, 13.
2. Grouping by e-mail domain (`main.pb.js` + `org.js`) means colleagues see the member's name and contributions: say it at sign-up. Art. 13.
3. `emailVisibility` is forced to `false` at sign-up (good, Art. 25). Members can still set it themselves: check the interface never asks them to.
4. Sign-up without e-mail verification lets someone create an account with another person's professional address (see `/security`): that is also an Art. 32 confidentiality issue for the organisation's data.

#### 4b. Notification e-mails and unsubscribe

1. `notify.js`: e-mails on every new record (to all members of the organisation) and on comments (to the author, voters and commenters). Lawful basis: legitimate interest (internal work tool), so an easy objection is required. Art. 21.
2. Opt-out exists: `users.mute_emails`, the checkbox `#aNotify` in "Mon compte", and `footerFor` / `footerText` explain how to unsubscribe. Check: the default (`mute_emails` false = opted in) is stated in the privacy policy; the footer tells users where to click; a one-click unsubscribe link (e.g. a signed URL) would be better than "log in and uncheck" (info). Art. 21, 12.
3. Content minimisation: the e-mails carry up to 600 characters of each record or comment (`excerpt(r.body, 600)`), so Brevo processes business content. Consider sending only the title and a link (info/warning). Art. 5(1)(c).
4. PocketBase system e-mails (OTP, password reset, verification, new-login alert `authAlert`) are service messages: no opt-out needed, but mention them.
5. Logging: `notify.js` `send` logs the recipient e-mail on failure (`app.logger().warn`): covered by the log retention below.

#### 4c. AI voice capture

1. Check the interface informs before recording: `#recStatus` and `#liveStatus` texts describe the flow but **don't name the provider or say where the audio goes**. Add one sentence and a privacy link near `#btnRec` / `#btnLive` (the provider name can come from `/api/app/ai/config`, which returns `provider`). Art. 13.
2. Nothing is published without review (the draft only fills the form): good for Art. 22 (no automated decision) and accuracy.
3. Realtime interview: the browser connects directly to OpenAI (`calls_url`), so the member's IP and voice go to the US. If the user or a client requires "no data outside the EU", recommend Mistral dictation only (per organisation: `ai_provider = mistral`). Art. 44-49.
4. Per-organisation keys: an organisation using its own key is the provider's customer; the operator should document who is controller/processor for that processing.
5. Audio retention in the app: `ai.pb.js` reads the uploaded file and forwards it; confirm nothing writes it to `pb_data` (no `app.save` of the file, no file field). Art. 5(1)(e).
6. Special categories: free-form voice stories may contain health or other sensitive data about colleagues or clients. The prompts in `domain.js` say "Ne nomme pas les personnes de manière critique": good; the privacy policy and a hint in the form should ask members not to share sensitive personal data. Art. 9.

#### 4d. Progression, votes and leaderboard

The `leaderboard` view ranks members by points, and the side column shows levels and badges. With employees, this can be perceived as evaluation: inform members, make the purpose explicit (encouragement, not assessment), consider hiding the ranking or making it opt-in, and never use it for HR decisions without a proper basis. Warning in an employment context. Art. 5(1)(a), 6, 22, CNIL guidance on employee monitoring.

#### 4e. MCP keys and agents

1. `api_keys`: 30-day expiry, revocable in `#dlgMcp`, `last_used` tracked (proportionate security logging). Expired keys are never deleted: add a cleanup (info). Art. 5(1)(e).
2. The consent page (`authorizePage` in `oauth.js`) says the agent acts "en votre nom, dans votre organisation seulement, avec vos droits": good. Add that the agent's provider will process the data it reads. Art. 13.
3. `oauth_clients` accumulate without limit (no personal data, hygiene).

#### 4f. Anonymous public activity (`stats.pb.js`)

The home page shows, without login, daily record counts, the number of organisations and the top tags of days with at least 2 records. Check: no personal data (titles, authors, organisation names) is returned; tags are free text and can reveal a person or a sensitive topic ("licenciement-dupont"); with a single organisation (or very few), "anonymous" counts describe one identifiable team. Warning if tags are shown and organisations are few. Art. 5(1)(c), 25.

#### 4g. Retention and logs

1. No automatic deletion anywhere: records, votes, comments, accounts of people who left, expired keys, `_authOrigins`. Define retention periods with the user (e.g. accounts deleted after N months of inactivity, records kept while the organisation is a customer) and document them; implement a cron cleanup if needed. Art. 5(1)(e).
2. Request logs: console > Settings > Logs. Check **Max days retention** (PocketBase default: 5), **IP logging** (default: on) and **auth id logging**. Keep IPs only as long as needed for security and state the period. Art. 5(1)(e), 32.
3. Backups: S3 "max backups" and schedule define how long deleted data survives; `deploy.yml` keeps the last 10 archives on the server. State it in the privacy policy (erasure is effective in backups after rotation). Art. 17.

#### 4h. Data subject rights

1. **Erasure:** `users.deleteRule` is `null`: members can't delete their account themselves; a superuser must do it in the console. Deleting a user cascades to their records, votes and comments (`cascadeDelete: true` on `items.author`, `votes.user`, `comments.author`, `api_keys.user`): make sure that is the intended behaviour (an alternative is anonymising records). Provide a contact address and a procedure, or a "Supprimer mon compte" action. Art. 17.
2. **Access and portability:** no export feature. A superuser can export via the API; document the procedure or add a JSON export of the member's own records (the MCP tools already let a member read them). Art. 15, 20.
3. **Rectification:** name editable in "Mon compte"; e-mail change is disabled in the form (`#aEmail` disabled, `updateRule` forbids `email`): provide a procedure. Art. 16.
4. **Organisation deletion** cascades to all its users (`users.organisation` `cascadeDelete: true`): document it for client offboarding.

#### 4i. Privacy policy

1. Search: `ls web/` for a page such as `confidentialite.html`, `politique-de-confidentialite.html`, `mentions-legales.html`; `grep -n "confidentialit\|privacy" web/index.html`. The skeleton has **none**: critical. Art. 12-14.
2. Required content: controller identity and contact; purposes and lawful basis per processing (accounts, records, votes and ranking, notifications, AI voice capture, MCP agents, public activity, security logs, backups); data categories; recipients and processors (hosting, S3, Brevo, AI provider, CDN); transfers outside the EU (OpenAI if used); retention periods; rights and how to exercise them; right to complain to the CNIL; DPO contact if any; the local storage used (session, theme).
3. Links: from the login card (`.login`), the sign-up mode, "Mon compte" (`#dlgAccount`) or the user menu, the AI blocks in `#dlgNew`, the OAuth consent page, and the e-mail footer (`footerFor`).

#### 4j. Security as a GDPR requirement

Summarise the `/security` items that affect personal data (Art. 32): e-mail verification (required by the skeleton, needs an e-mail channel), the one-way twin password sync, rate limiting, security headers set on the proxy, HTTPS, backups encryption and access, superuser MFA. If `/security` ran in the same `/quality` session, reference its findings instead of repeating them.

### Step 5: Present the report

```
## GDPR Compliance Audit Report

### Summary
- Critical issues: X
- Warnings: X
- Info/Recommendations: X
- Processors and third parties found: X (Y outside the EU)
- Data collection points found: X
- Delta: [if previous audit] +X new, -Y resolved, Z unchanged

### Critical Issues (must fix for GDPR compliance)
[For each issue:]
- Description
- GDPR article(s) with citation
- Where (file path + concept: collection, field, function, element id)
- Remediation guidance
- Severity justification

### Warnings (should fix)
[Same format]

### Info & Recommendations (good practice)
[Same format]

### Personal Data Inventory
| Collection / place | Data | Purpose | Lawful basis | Retention | Who can see it |
|--------------------|------|---------|--------------|-----------|----------------|

### Processors and Third Parties
| Service | Data sent | EU/non-EU | Contract (DPA/SCC) | In privacy policy? | Status |
|---------|-----------|-----------|--------------------|--------------------|--------|

### Browser Storage and Cookies
| Key / cookie | Set by | Purpose | Consent required? |
|--------------|--------|---------|-------------------|

### Data Subject Rights
| Right | How it works today | Gap |
|-------|--------------------|-----|

### Privacy Policy Checklist (Art. 13/14)
- [ ] Controller identity and contact
- [ ] Purposes and lawful basis per processing
- [ ] Data categories
- [ ] Recipients and processors
- [ ] Transfers outside the EU
- [ ] Retention periods (data, logs, backups)
- [ ] Data subject rights and procedure
- [ ] Right to complain to the CNIL
- [ ] DPO contact (if applicable)
- [ ] Local storage used

### Notes
- Security headers on the local instance differ from production (the proxy adds them)
- Processor contracts (DPA, SCCs) are contractual matters, not code fixes
- This is an automated audit -- it does not replace legal counsel for full GDPR compliance
```

### Step 6: Offer to fix

> "Would you like me to fix any of these issues? I can:
> 1. Fix all critical issues
> 2. Fix specific issues (tell me which)
> 3. Generate missing artifacts (privacy policy page, information texts near the forms and the microphone, records of processing template)
> 4. No fixes -- I'll keep the report for reference"

**Fix risk assessment -- apply to every finding:**

| Fix type | Risk | Why |
|----------|------|-----|
| Generate `web/confidentialite.html` with `[TODO: ...]` placeholders | ✅ Safe | New static page served by PocketBase from `web/`, doesn't affect the app |
| Add privacy links (login card, "Mon compte", `#dlgNew` AI blocks, e-mail footer, OAuth page) | ✅ Safe | Additive links |
| Add information sentences near `#btnRec` / `#btnLive` and at sign-up | ✅ Safe | Additive text (French, no em dash) |
| Set log retention / IP logging in the console | ✅ Safe | Settings change, documented |
| Shorten notification e-mail content to title + link (`renderItemEmail`, `renderCommentEmail`) | ⚠️ Caution | Changes what members receive; some may prefer the excerpt |
| Self-host the PocketBase SDK instead of jsdelivr | ⚠️ Caution | The file must be updated with the SDK version; a wrong path blocks the interface |
| Hide tags from the public activity (`stats.pb.js`) | ⚠️ Caution | Changes the home page |
| Add a cleanup cron for expired keys / inactive accounts | 🚫 Risky | Deletes data permanently; cascades remove records; retention periods must be decided first |
| Add "Supprimer mon compte" (`users.deleteRule` or a hook) | 🚫 Risky | Cascade deletes the member's records, votes and comments for the whole team; needs a decision (delete vs anonymise), a migration and tests |
| Hide or remove the leaderboard | 🚫 Risky | Product decision; see `.claude/skills/start/guides/remove-progression.md` |
| Force Mistral-only / disable realtime | 🚫 Risky | Removes a feature members may use; per-organisation settings to migrate |

**Fix risk gating (same rules as /quality):**
- ✅ Safe: apply directly
- ⚠️ Caution: apply, then summarize what changed
- 🚫 Risky: **STOP after Safe/Caution fixes.** Ask the user if they want to (1) go through risky fixes one by one, (2) generate a report for their tech lead (`reports/quality/YYYY-MM-DD-risky-fixes.md`), or (3) skip entirely. See /quality SKILL.md Step 9 for the full flow.

**When fixing:**
- **Privacy policy page:** create `web/confidentialite.html` (static, served at `/confidentialite.html`), in French, reusing the CSS tokens and system fonts of `web/index.html` (copy the `:root` token blocks, both themes), with every Art. 13/14 section and clear `[TODO: ...]` markers for controller, host, processors, retention, contact. Pre-fill what the code proves (data map above, processors enabled in the code).
- **Links and texts:** edit `web/index.html` (French UI text, no em dash), `authorizePage` in `oauth.js`, `footerFor` / `footerText` in `notify.js`.
- **Console settings:** give the user the exact screens (Settings > Logs, Settings > Backups); you cannot change them yourself.
- **Contracts:** DPA with Brevo, the AI provider, the host and the S3 provider are the user's responsibility; list them.

**Fix flow (same as /quality Step 9):**
1. Apply all ✅ Safe and ⚠️ Caution fixes. Update the practice docs (`ai/WEB_PRACTICES.md`, `ai/AI_PRACTICES.md`, `ai/POCKETBASE_PRACTICES.md`, or `.claude/practices.md`) with the patterns just introduced (e.g. privacy link placement, information text before recording, retention settings).
2. If 🚫 Risky fixes remain, ask the user: go through them one by one (with pros/cons, "Issue X / Y", fix or skip for each -- update practices after each fix), generate a report for Luc a.k.a. the professional fixer, or skip entirely.
3. **Automatically re-run the audit.** Show the delta.

## ARGUMENTS

- No argument: full audit (all checks)
- `--quick`: code-level only (no runtime checks)
- `--fix`: skip report, fix all critical issues directly (risky fixes still require confirmation)
- `--delta`: only show what changed since last audit
- `--generate-privacy`: generate the privacy policy page template only

$ARGUMENTS
