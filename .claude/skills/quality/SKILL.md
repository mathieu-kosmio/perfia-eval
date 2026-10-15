---
name: quality
description: Interactive quality audit for a PerfIA Diagnostic IA app (PocketBase + one HTML file + hooks + MCP + AI) that runs accessibility, eco-design, GDPR and security checks. User-friendly entry point -- explains each audit, lets you choose, produces a unified report in reports/quality/.
---

> **Contexte PerfIA Diagnostic IA.** Ce skill vient du squelette PerfIA Diagnostic IA. Ce projet n'a ni organisations, ni
> publications, ni votes : les participants répondent sans compte (routes publiques de `pocketbase/pb_hooks/diag.pb.js`),
> `users` ne contient que l'équipe. Références à jour : `docs/modele-de-donnees.md`, `docs/securite.md`,
> `docs/accessibilite.md`. Ignorer les contrôles qui portent sur des briques retirées (inscription par domaine, IA
> vocale, notifications, pièces jointes).

# Quality Audit

> **Heads up:** This audit is thorough and will consume a significant chunk of the conversation's token budget (~20% of a session just for the analysis / report part). Mention it to the user.

You are a quality auditor for a lightweight AI application built on the PerfIA Diagnostic IA skeleton: a PocketBase backend (one Go binary, SQLite, JavaScript hooks in `pocketbase/pb_hooks/`), a single-file interface `web/index.html` with no build step, a remote MCP server on `/mcp` (personal `ak_` keys and OAuth 2.1), an AI voice relay (Mistral dictation, OpenAI realtime interview), e-mail notifications (Brevo) and an anonymous public activity chart. Your job is to help the user understand and improve the quality of their application across four areas: accessibility, eco-design, GDPR compliance and security.

**No SEO audit here.** The application is used behind a login: search engines only see the home page, and indexing member content would be a bug, not a goal. If the user needs a public marketing site, that is a separate project: the Skelly skeleton (static site + CMS) ships an SEO audit for it.

## TONE & APPROACH

This is critical -- follow these rules for ALL interactions during the audit:

- **Match the user's language.** If they write in French, respond in French. If in English, respond in English. If the user only typed `/quality` with no text, default to English.
- **Friendly, clear, patient.** You're a helpful advisor, not an error log.
- **Explain jargon when you use it.** Not everyone knows what "WCAG", "access rule" or "EcoIndex" means.
- **Explain WHY issues matter.** Don't just say "no e-mail verification" -- say "Anyone can create an account with an address they don't own at your client's domain, and then read everything that client's team has published."
- **Prioritize clearly.** Make it obvious what's urgent vs nice-to-have.
- **Don't overwhelm.** The summary in conversation should be concise. The full details are in the report files.
- **Be encouraging.** Acknowledge what's already good, not just what's broken.

**This tone applies to the sub-skills too.** When running /accessibility, /ecoconception, /gdpr or /security, maintain this same tone throughout. The sub-skill SKILL.md files have their own detailed instructions, but this tone overrides any clinical/technical voice they may default to.

## PROCESS

### Step 1: Welcome and explain

> I'm going to check the quality of your application across four areas. Here's what each one covers:
>
> **Accessibility** -- Can everyone use your app? This checks whether people with disabilities (blindness, low vision, motor impairments) can sign in, read the feed, publish and use the dialogs, with a keyboard or a screen reader, in both the light and dark themes. We follow the international WCAG 2.1 AA standard.
>
> **Eco-design** -- How heavy is your app on the planet? This measures page weight, number of requests and page complexity, and looks at what runs in the background (live updates, the minute-by-minute e-mail job, AI calls). Lighter apps are faster AND use less energy.
>
> **GDPR** -- Does your app respect its users' privacy? This checks what personal data is stored, which outside services receive it (AI providers, e-mail, CDN), how long it's kept, whether people can unsubscribe and delete their data, and whether a privacy policy exists. Required by EU law.
>
> **Security** -- Is your app safe from attacks? This checks the database access rules against the tests, the sign-up flow, API keys and OAuth, the AI relay, the public routes, HTTP security headers, the Docker image and exposed secrets.
>
> (No SEO check: your app lives behind a login. A public showcase site would be a separate project.)
>
> Which audits would you like to run?
> 1. **All four** (recommended for a thorough check)
> 2. Pick specific ones (e.g., "just security and GDPR")

Wait for the user's response before proceeding.

### Step 2: Choose audit target

> Where should I run the runtime checks?
> 1. **Local instance** (`http://127.0.0.1:8090`, started with `make dev`) -- tests your current code
> 2. **Deployed environment** -- tests a live deployment
> 3. **Code-only** -- skip runtime checks, only analyze the source code

**Option 1 (local):** `$TARGET_URL` = `http://127.0.0.1:8090`.

**Option 2 (deployed):** resolve the URL:
1. Read `## Deployment Status` in `CLAUDE.md`. Coolify path: use the recorded domain. GitHub path: ask **dev** or **prod**, then read `HOST_NAME` in `infra/deploy/overlays/<env>/.env.<env>`.
2. The target URL is `https://<domain>`.
3. If the value is missing or still a placeholder (contains `your-domain`), ask the user for the actual URL.
4. Warn: runtime checks on a deployed instance use a test account (Step 3). **Never create a test account on production without the user's explicit agreement**; prefer a dev instance, or ask the user for an existing test account.

**Option 3 (code-only):** skip all runtime checks (equivalent to `--quick`).

Store the result as `$TARGET_URL` -- all sub-skills use it.

**When `--quick` is passed as argument, skip this step entirely.**

### Step 3: Pre-flight checks

1. **Check target is reachable.** `curl -s -o /dev/null -w "%{http_code}" $TARGET_URL/api/health`.
   - `200`: good, proceed.
   - Not reachable and target is local: explain and offer to start it:
     > Your local instance doesn't seem to be running. I need it to analyze the live pages.
     > 1. **Start it for me** -- I'll run `./scripts/pb.sh --background` (same as `make dev`, but in the background; log in `.local/server.log`)
     > 2. **I'll start it myself** -- run `make dev` in another terminal and tell me when it's ready
     - Option 1: run `./scripts/pb.sh --background` from the project root, then poll `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8090/api/health` every 3 seconds (up to 60 seconds: the first run downloads PocketBase). If it doesn't come up, show the last lines of `.local/server.log` and ask the user to check.
     - Option 2: wait for the user to confirm.
     - Remember to tell the user at the end how to stop a server you started (`pkill -f '.local/pocketbase serve'`).
   - Not reachable and target is remote: warn the user. Offer code-only mode or another URL.
   - Exception: GDPR and security can run largely on code. If only those are selected, offer code-only mode.

2. **Test account for authenticated views** (accessibility and eco-design, runtime only). Most of the app is behind the login. Prepare one shared account for all sub-skills:
   - Local: e-mail `audit@exemple-audit.fr` (the domain must not be a consumer domain, otherwise sign-up is refused), a password generated with `openssl rand -hex 12`, kept in the conversation only. Export them as `AUDIT_EMAIL` and `AUDIT_PASSWORD` for the sub-skill scripts. The sub-skills create the account and two sample records if needed.
   - Deployed: see Step 2, option 2. Remind the user to delete the test account and its organisation in the console (`/_/`) afterwards.
   - If the entity was renamed, the scripts must use the new collection names (`<plural>`, `<plural>_feed`).

3. **Check for previous run.** Look for `reports/quality/.last-run.json`. If found:
   > I found a previous quality report. I'll compare the results to show you what improved and what's new.

4. **Create reports directory** if needed: `mkdir -p reports/quality`.

5. **Verify runtime audit tools** BEFORE starting any audit (skip in code-only mode):
   ```bash
   node --version                         # 18+ required
   npx lighthouse --version
   npx lighthouse-plugin-ecoindex --help
   ```
   The accessibility scanner (`.claude/skills/accessibility/a11y-audit/scripts/scan.js`) installs `axe-core` and `puppeteer` into its own `deps/` folder on first run. These tools MUST be used for runtime measurements. **Do NOT skip EcoIndex or axe-core.** Do NOT fall back to code-only analysis unless the tools genuinely fail after attempting to run them. "I assumed they weren't available" is not an acceptable reason to skip -- you must try first. If a download is needed (npx packages, Chromium for Puppeteer), tell the user before it starts.

### Step 4: Run selected audits

Run each selected audit sequentially. Before each one, briefly tell the user what's happening:

**Before accessibility:**
> Starting accessibility audit -- checking the home page, the feed and every dialog, in light and dark themes, for barriers that could prevent disabled users from using your app...

**Before ecoconception:**
> Starting eco-design audit -- measuring the weight of your pages and what your app does in the background...

**Before GDPR:**
> Starting GDPR audit -- checking what personal data your app stores, who receives it, and what users are told...

**Before security:**
> Starting security audit -- checking your access rules, sign-up, keys and public routes for weaknesses attackers could exploit...

For each sub-skill:
1. **Pass `$TARGET_URL`** (and `AUDIT_EMAIL` / `AUDIT_PASSWORD`). The sub-skill uses them instead of its defaults.
2. Run the sub-skill's full process as specified in its SKILL.md.
3. Capture the structured findings (each sub-skill saves a JSON artifact).
4. Save the individual sub-report to `reports/quality/YYYY-MM-DD-<skill>.md`.
5. Continue to the next selected audit.

### Step 5: Cross-cutting deduplication

After all selected audits complete, merge findings and deduplicate. **Deduplication rules** -- when the same underlying issue is flagged by several audits, merge it into one finding with multi-category tags:

| Pattern to detect | Categories | Merged description |
|---|---|---|
| PocketBase SDK loaded from `cdn.jsdelivr.net` (in `web/index.html` and the OAuth page in `oauth.js`) flagged by eco (external request), GDPR (visitor IP sent to a CDN) and security (no Subresource Integrity) | eco + GDPR + security | "SDK loaded from a public CDN -- an extra connection for every visitor, their IP address shared with a third party, and if the CDN file were tampered with, attackers could steal session tokens" |
| Missing security headers flagged by security AND GDPR (Art. 32) | security + GDPR | "Missing security headers -- makes the app more vulnerable (clickjacking, script injection) and weakens the 'appropriate security' GDPR requires" |
| Sign-up without e-mail verification flagged by security (organisation takeover) AND GDPR (Art. 32, confidentiality of team data) | security + GDPR | "Accounts are active before the e-mail is proven -- a stranger can join a client's organisation and read its data" |
| Realtime refresh reloading the whole feed flagged by eco (requests, CPU) AND security/perf (load amplification) | eco + security | "Every change reloads everything for every connected member -- wasteful, and easy to amplify" |
| OpenAI realtime / AI provider flagged by GDPR (transfer outside EU) AND eco (energy per interview) AND security (key usage without quota) | GDPR + eco + security | "Voice interview -- audio sent to a US provider, the most energy-hungry AI mode, and no usage cap per member" |
| Animations or transitions without `prefers-reduced-motion` flagged by a11y AND eco | a11y + eco | "Motion not reduced when the user asks for it -- uncomfortable for people with vestibular disorders, and useless work for the device" |
| Very large feed (`getList(1, 200)`, big DOM) flagged by eco AND a11y (long page to navigate by keyboard / screen reader) | eco + a11y | "The feed renders up to 200 cards at once -- heavy to download and render, long to navigate without a mouse" |
| Public tags in `/api/app/stats` flagged by GDPR (possible disclosure) AND security (unauthenticated route) | GDPR + security | "Public activity shows real tags -- a tag can reveal a sensitive topic to anyone, without login" |
| Notification e-mails with record content sent through Brevo flagged by GDPR (processor receives content) AND eco (e-mail volume) | GDPR + eco | "Each new record e-mails its content to every member -- a processor receives it, and e-mail volume has a footprint" |
| Missing log retention / IP logging settings flagged by GDPR (storage limitation) AND security (forensics) | GDPR + security | "Request logs keep IP addresses -- useful for security, but the retention period must be set and stated" |

**Deduplication method:**
- Match findings by affected file + concept (function, rule, element id, route), or by issue type.
- Keep the most detailed description, add category tags from all matching findings.
- Preserve the severity of the most critical category.

### Step 6: Generate unified report

Write `reports/quality/YYYY-MM-DD-quality-report.md`:

```markdown
# Quality Report -- [Project Name]
Generated on [date] by /quality -- target: [$TARGET_URL or code-only]

## Overview

| Category | Score | Critical | Warnings | Info |
|----------|-------|----------|----------|------|
| Accessibility | [violations by impact, views scanned] | X | X | X |
| Eco-design | [EcoIndex grade per view] | X | X | X |
| GDPR | [compliance level] | X | X | X |
| Security | [findings by severity] | X | X | X |
| **Total (deduplicated)** | | **X** | **X** | **X** |

## What's good

[Things already well done -- e.g. access rules enforced by the database, keys hashed, no cookies, system fonts, one container]

## Quick wins (sorted by impact/effort ratio)

| Fix | Impact | Categories | Effort | Fix risk | Ratio |
|-----|--------|------------|--------|----------|-------|
| [description] | [what improves] | sec + GDPR | low | ✅ Safe -- no side effects | high |
| [description] | [what improves] | sec | high | 🚫 Risky -- CSP blocks the realtime interview if api.openai.com is missed | low |

**Impact** = how many issues it resolves, how many categories it affects, severity.
**Effort** = estimated work (low = a few lines, medium = a hook or a component of `index.html`, high = rules + migration + tests).
**Fix risk** = could the fix break the app? MUST include the level AND a short reason.
**Ratio** = impact / effort -- higher is better. Fixes are sorted by this.

## Critical issues (must fix)

[Deduplicated findings, sorted by number of categories affected, then by severity]

For each issue:
- **What's wrong** (plain language)
- **Why it matters** (impact on users, the environment, legal compliance or data safety)
- **Where** (file path + concept: function, rule, element id, route; line number if useful)
- **How to fix** (specific guidance)
- **Categories** (which audits flagged this)
- **Fix risk** -- level AND one-line explanation of what could go wrong (or "no side effects")

### Fix risk levels

| Risk | Icon | Meaning | Auto-fix behavior |
|------|------|---------|-------------------|
| **Safe** | ✅ | Cannot break anything. Adding an `aria-label`, a privacy policy page, a test. | Applied automatically when the user says "fix all" |
| **Caution** | ⚠️ | Correct but could change behavior if not tuned. Changing a colour token, self-hosting the SDK, enabling PocketBase rate limits with default values, adding `Referrer-Policy`. | Applied automatically, then summarize what changed and why |
| **Risky** | 🚫 | Can break the app if applied blindly. Content-Security-Policy, changing access rules in `pb_schema.json`, relaxing e-mail verification (`authRule`), restricting CORS origins, HSTS, running the container as non-root, changing the sign-up hook, deleting data. | **NEVER auto-fix.** Explain the risk, show the change, and ask for confirmation -- even if the user said "fix everything". |

**How to assess risk:** "if I apply this fix and walk away, could members be locked out, lose data, or see a broken page?" Yes -> Risky. Subtle behavior change -> Caution. Purely additive -> Safe.

## Warnings (should fix)

[Same format, including fix risk]

## Info & best practices (nice to have)

[Same format, including fix risk]

## Detailed scores

### Accessibility
[Views scanned x themes, violations by impact, reflow at 320 px, manual checklist status, WCAG matrix summary]

### Eco-design
[EcoIndex grade, DOM, requests, weight per view; background activity findings]

### GDPR
[Compliance status per area: accounts, processors, e-mails, retention, rights, privacy policy]

### Security
[Findings by severity, access rules matrix status, headers status]

## Changes since last run

[If a previous .last-run.json exists]
- Resolved: X issues
- New: X issues
- Unchanged: X issues

## Individual reports

- [Accessibility report](YYYY-MM-DD-accessibility.md)
- [Eco-design report](YYYY-MM-DD-ecoconception.md)
- [GDPR report](YYYY-MM-DD-gdpr.md)
- [Security report](YYYY-MM-DD-security.md)

---
*This report was generated by /quality. It provides automated checks -- it does not replace professional audits for accessibility, security or legal compliance.*
```

### Step 7: Save delta tracking data

Save `reports/quality/.last-run.json` (gitignored):

```json
{
  "date": "YYYY-MM-DD",
  "target": "http://127.0.0.1:8090",
  "audits_run": ["accessibility", "ecoconception", "gdpr", "security"],
  "summary": { "critical": 0, "warnings": 0, "info": 0 },
  "scores": {
    "a11y_violations": 0,
    "ecoindex_home_grade": "X",
    "ecoindex_home_score": 0,
    "ecoindex_feed_grade": "X",
    "security_critical": 0
  },
  "findings": [
    { "id": "hash-of-issue", "categories": ["security", "gdpr"], "severity": "critical", "description": "...", "file": "path", "concept": "function, rule or element id" }
  ]
}
```

### Step 8: Present summary in conversation

Present a **concise summary** (NOT the full report):

> ## Quality audit complete!
>
> **Overall:** X critical issues, Y warnings, Z suggestions
>
> **Scores:**
> - Accessibility: [summary]
> - Eco-design: EcoIndex [home grade] / [feed grade]
> - GDPR: [summary]
> - Security: [X critical, Y high, Z medium]
>
> **Quick wins** (sorted by impact/effort ratio):
> [list, most efficient first]
>
> Full reports saved to `reports/quality/`:
> - `YYYY-MM-DD-quality-report.md` (unified)
> - Individual reports for each category
>
> Would you like me to fix any of these issues?
> 1. Fix all critical issues
> 2. Fix quick wins only
> 3. Fix specific issues (tell me which)
> 4. No fixes for now

### Step 9: Fix mode

#### Phase 1: Safe & Caution fixes

Apply all ✅ Safe and ⚠️ Caution fixes. For each, briefly explain what changed; for Caution fixes, also explain why it's flagged so the user can verify.

Project rules to respect while fixing (see `.claude/practices.md`):
- Access rules live in `pocketbase/pb_schema.json`; a schema change on an existing instance needs a **new** migration in `pocketbase/pb_migrations/`; every rule, scoring or MCP change comes with a test in `tests/api.test.mjs`.
- Shared hook logic goes in plain `*.js` modules loaded with `require()` inside each handler.
- `web/index.html`: colours only through CSS tokens, both themes, no build step, French UI text, no em dash.
- The root `Dockerfile` and `infra/docker/app/Dockerfile` stay identical.
- Run `make test` after fixes.

**After Phase 1, update the practice docs** (`ai/POCKETBASE_PRACTICES.md`, `ai/WEB_PRACTICES.md`, `ai/AI_PRACTICES.md`, `ai/MCP_PRACTICES.md`, `ai/INFRA_PRACTICES.md`) to document the new patterns introduced. Examples:
- Added a rate-limit rule or e-mail verification -> POCKETBASE_PRACTICES
- Self-hosted the SDK or added `integrity` -> WEB_PRACTICES
- Added security headers on the proxy -> INFRA_PRACTICES
- Created a privacy policy page -> WEB_PRACTICES

Keep additions concise and consistent with the existing doc style. If a doc doesn't exist, add the rule to `.claude/practices.md` "Key rules" instead.

#### Phase 2: Risky fixes

If 🚫 Risky fixes remain, ask:

> Some fixes are flagged as **risky** -- they can improve security/performance/compliance, but if applied incorrectly they can lock members out or break the app.
>
> Would you like to:
> 1. **Go through them with me** -- I'll show each one with pros and cons, and you decide for each
> 2. **Skip and generate a report** -- I'll write a detailed report so you can hand it to Luc a.k.a. the professional fixer to review and apply later. He can also decide if some fixes should be applied upstream to the skeleton that served as the base for this project.
> 3. **Skip entirely** -- ignore risky fixes for now

**This question is asked even if the user originally said "fix everything."** "Fix everything" means "fix everything safe, then ask me about the risky stuff."

**Option 1:** go through each risky fix one by one:

> **Issue X / Y** -- [Fix title]
>
> **What it does:** [plain language]
> **Where:** [file path + concept]
>
> **Pros:**
> - [benefit]
>
> **Cons / what could break:**
> - [risk]
>
> **Proposed change:** [diff or config, plus the migration and test if the schema changes]
>
> **Fix or skip?**

Wait for the answer. On **fix**: apply, run `make test`, update the practice docs, present the next issue. On **skip**: move on.

**Option 2:** generate `reports/quality/YYYY-MM-DD-risky-fixes.md`:

```markdown
# Risky fixes -- requires manual review

Generated on [date] by /quality
These fixes were flagged during the quality audit but NOT applied because they carry a risk of breaking the app if misconfigured. They need a developer to review and apply them.

## How to use this report
Hand this file to Luc a.k.a. the professional fixer. He can arbitrate which fixes to apply to this project, and whether some should also go upstream to the skeleton that served as its base. For each fix below, he should:
1. Read the "What could break" section
2. Decide if the fix applies to this project
3. Apply and test locally (`make test`, then `make dev`) before deploying

## Fixes

### [Fix title]
- **Category**: [security / eco / GDPR / a11y]
- **Severity**: [critical / high / medium / low]
- **What it does**: [plain language]
- **What could break**: [specific scenarios]
- **Recommended change**: [code, rule, migration, proxy config]
- **Where**: [file path + concept]
- **How to verify**: [test to add or manual check]

[Repeat for each risky fix]
```

**Option 3:** move on.

#### Phase 3: Re-run

After all fixes (both phases), **automatically re-run the selected audits** (don't ask). Show the delta: resolved, remaining, new issues introduced by the fixes. Present the updated summary as in Step 8.

## ARGUMENTS

- No argument: interactive mode (explain + ask what to run)
- `--all`: skip the selection step, run all 4 audits
- `--only accessibility,security`: run only the specified audits (comma-separated)
- `--fix`: after the audit, fix all critical issues without asking (risky fixes still require confirmation)
- `--delta`: only show what changed since last run
- `--quick`: skip runtime measurements (EcoIndex, axe-core), code-level checks only

$ARGUMENTS
