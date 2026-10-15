---
name: accessibility
description: Audit the PerfIA Diagnostic IA app's accessibility (WCAG 2.1 AA). Runs axe-core on every view (home, feed, user menu, dialogs) in light and dark themes with a 320 px reflow check, plus a manual checklist on web/index.html (labels, ARIA states, live regions, native dialogs, focus, token contrasts, reduced motion). Produces an actionable report, then offers to fix issues.
---

> **Contexte PerfIA Diagnostic IA.** Ce skill vient du squelette PerfIA Diagnostic IA. Ce projet n'a ni organisations, ni
> publications, ni votes : les participants répondent sans compte (routes publiques de `pocketbase/pb_hooks/diag.pb.js`),
> `users` ne contient que l'équipe. Références à jour : `docs/modele-de-donnees.md`, `docs/securite.md`,
> `docs/accessibilite.md`. Ignorer les contrôles qui portent sur des briques retirées (inscription par domaine, IA
> vocale, notifications, pièces jointes).

# Accessibility Audit

You are an accessibility auditor for a PerfIA Diagnostic IA application: a PocketBase backend and a single-file interface `web/index.html` (no build, no framework, vanilla JavaScript, native `<dialog>`, CSS tokens with a light and a dark theme). Your job is to find WCAG 2.1 AA violations and help the user fix them.

## TONE & APPROACH

- **Match the user's language.** French if they write in French, English if English. If the user only typed `/accessibility` with no text, default to English.
- **Friendly, clear, patient.** You're a helpful advisor, not an error log.
- **Explain jargon.** Not everyone knows what "WCAG", "ARIA", "live region" or "reflow" means.
- **Explain WHY issues matter.** Don't just say "missing label" -- say "A field without a label is announced as 'edit text' by a screen reader: a blind user can't know what to type."
- **Be encouraging.** Acknowledge what's already good (skip link, native dialogs, reduced-motion handling...), not just what's broken.
- **When invoked via /quality:** follow /quality's unified tone. When invoked standalone, use this same tone.

## THE APP'S VIEWS

There is no sitemap and almost no URL routing: the whole interface lives in `web/index.html` and changes state in place. The scan works on **views**, not URLs:

| View | How to reach it | Element to scope |
|------|-----------------|------------------|
| Home, logged out | Open `/` without a session (`#viewLogin`: intro, login card, activity chart) | document |
| Home, sign-up mode | Click `#toggleMode` ("Créer un compte"): shows `#wrapName` | document |
| Feed, logged in | Log in (`#viewApp`: toolbar `#sort` and `#q`, `#feed`, side column), open one card with `[data-open]` ("Lire") so the comment form renders | document |
| User menu | Click `#btnMenu` (`#dropdown`) | `#userMenu` |
| Publish dialog | Click `#btnNew` (`#dlgNew`, form `#formNew`) | `#dlgNew` |
| Organisation dialog | Menu > `[data-menu="org"]` (`#dlgOrg`) | `#dlgOrg` |
| Account dialog | Menu > `[data-menu="account"]` (`#dlgAccount`) | `#dlgAccount` |
| AI agent dialog | Menu > `[data-menu="mcp"]` (`#dlgMcp`) | `#dlgMcp` |
| OAuth consent page (optional) | Separate HTML rendered by `authorizePage` in `pocketbase/pb_hooks/oauth.js` at `/oauth/authorize` | document |

Each view is scanned in **both themes** (`document.documentElement.dataset.theme = "light"` / `"dark"`).

Views that no longer exist (removed features: no `#dlgMcp` after `remove-mcp.md`, no `#activity` after `remove-public-stats.md`...) are skipped. The AI blocks `#realtime` and `#dictate` inside `#dlgNew` are only visible when an AI key is configured: note "not scanned at runtime" if they are hidden, and cover them in the manual checklist.

## PROCESS

### Step 1: Choose audit target

If invoked via `/quality`, `$TARGET_URL` (and `AUDIT_EMAIL` / `AUDIT_PASSWORD`) are already set -- skip to pre-flight checks.

If invoked standalone, ask:

> Where should I run the runtime checks?
> 1. **Local instance** (`http://127.0.0.1:8090`, started with `make dev`) -- tests your current code
> 2. **Deployed environment** -- tests a live deployment
> 3. **Code-only** -- skip runtime checks, only run the manual checklist on `web/index.html`

- **Option 1:** `$TARGET_URL` = `http://127.0.0.1:8090`.
- **Option 2:** read the domain from `## Deployment Status` in `CLAUDE.md` (Coolify), or `HOST_NAME` in `infra/deploy/overlays/<env>/.env.<env>` (GitHub path, ask dev or prod). If missing or a placeholder (`your-domain`), ask for the URL. A test account is needed: never create one on production without explicit agreement.
- **Option 3:** skip runtime checks (equivalent to `--static-only`).

**When `--static-only` is passed as argument, skip this step entirely.**

### Step 2: Pre-flight checks

1. **Target reachable?** `curl -s -o /dev/null -w "%{http_code}" $TARGET_URL/api/health`.
   - Not reachable and local: offer to start it with `./scripts/pb.sh --background` (same as `make dev`, in the background), or let the user run `make dev`; poll until `200`.
   - Not reachable and remote: warn, offer static-only mode.
2. **Node.js 18+:** `node --version`.
3. **Test account.** If `AUDIT_EMAIL` / `AUDIT_PASSWORD` are not set: use `audit@exemple-audit.fr` (any non-consumer domain works: `gmail.com`, `outlook.fr`... are refused at sign-up by `PUBLIC_DOMAINS` in `domain.js`) and a password from `openssl rand -hex 12`. The scan script signs up this account if needed (it creates an organisation `exemple-audit.fr` in the local database) and adds two sample records so the feed isn't empty. If the project uses a single organisation with closed sign-up, ask the user for a test account instead.
4. **Previous audit:** `.claude/skills/accessibility/a11y-audit/last-audit.json` (gitignored). If found, use it for delta comparison.

### Step 3: Runtime audit (axe-core + Puppeteer)

1. **Read the bundled skill instructions** at `.claude/skills/accessibility/a11y-audit/SKILL.md`. Follow its phases (environment discovery, scanning, compliance mapping, manual guidance, output). Output mode: `markdown+json`. If `.a11y-audit/PROJECT_CONTEXT.md` doesn't exist at the project root, create it (the script has no `--help`: any run writes the file):
   ```bash
   node .claude/skills/accessibility/a11y-audit/scripts/bootstrap-context.js \
     --name "<project name>" --base_url $TARGET_URL \
     --output_mode markdown+json --report_path reports/quality/YYYY-MM-DD-accessibility.md
   ```
   Then append the view list above and the colour token names of `web/index.html` to it. Tell the user this folder now exists at the project root and ask whether to commit it or add `.a11y-audit/` to `.gitignore`.

   All temporary files below go to a scratch directory created once: `A11Y_TMP=$(mktemp -d)`.

2. **Install the scanner dependencies and scan the logged-out home page** with the bundled scanner (it auto-installs `axe-core` and `puppeteer` into `a11y-audit/deps/`; tell the user a Chromium download may happen on first run):
   ```bash
   node .claude/skills/accessibility/a11y-audit/scripts/scan.js \
     --root . \
     --urls $TARGET_URL/ \
     --output "$A11Y_TMP/a11y-home.json" \
     --summary
   ```
   Also scan the OAuth consent page if the MCP is kept: register a throwaway client with `curl -s -X POST $TARGET_URL/oauth/register -H 'Content-Type: application/json' -d '{"client_name":"Audit","redirect_uris":["http://localhost:9999/cb"]}'`, then add `$TARGET_URL/oauth/authorize?response_type=code&client_id=<id>&redirect_uri=http%3A%2F%2Flocalhost%3A9999%2Fcb&code_challenge=audit&code_challenge_method=S256` to `--urls`.

3. **Scan every view in both themes.** `scan.js` only loads URLs: it cannot log in, open a dialog or switch the theme. As the bundled skill allows for behavior it doesn't support, write this ad hoc script to a temporary file (not in the repository, not inside `a11y-audit/`), for example `$A11Y_TMP/a11y-views.cjs`. It reuses the dependencies installed by `scan.js` and writes the same JSON shape, so `report.js` can consume it:

   ```js
   // PerfIA Diagnostic IA accessibility view scan: axe-core on each view, light and dark theme, plus a 320 px reflow check.
   // Output has the same shape as a11y-audit/scripts/scan.js, so a11y-audit/scripts/report.js can consume it.
   const fs = require("fs");
   const puppeteer = require("puppeteer");
   const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

   const BASE = (process.env.TARGET_URL || "http://127.0.0.1:8090").replace(/\/+$/, "");
   const EMAIL = process.env.AUDIT_EMAIL || "audit@exemple-audit.fr";
   const PASSWORD = process.env.AUDIT_PASSWORD;
   const OUT = process.env.OUT || "a11y-views.json";
   if (!PASSWORD) { console.error("AUDIT_PASSWORD is required"); process.exit(1); }

   const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
   const api = async (method, path, body, token) => {
     const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
     return { status: res.status, data: await res.json().catch(() => null) };
   };

   // Test account (domain must not be a consumer domain) and two records so the feed is not empty.
   // If the entity was renamed, replace items / items_feed with the new collection names.
   async function ensureAccount() {
     await api("POST", "/api/collections/users/records", { email: EMAIL, password: PASSWORD, passwordConfirm: PASSWORD, name: "Audit Accessibilite" });
     const auth = await api("POST", "/api/collections/users/auth-with-password", { identity: EMAIL, password: PASSWORD });
     if (auth.status !== 200) throw new Error("Cannot log in the audit account: " + JSON.stringify(auth.data));
     const { token, record } = auth.data;
     const feed = await api("GET", "/api/collections/items_feed/records?perPage=1", null, token);
     if (!feed.data || !feed.data.totalItems) {
       for (const title of ["Premier enregistrement d'audit", "Second enregistrement d'audit"]) {
         await api("POST", "/api/collections/items/records", { organisation: record.organisation, author: record.id, title, body: "Contenu de test pour l'audit d'accessibilité.", tags: ["audit", "test"] }, token);
       }
     }
   }

   const click = (sel) => async (page) => { await page.click(sel); await sleep(400); };
   const openMenuItem = (key) => async (page) => { await page.click("#btnMenu"); await page.click(`[data-menu="${key}"]`); await sleep(400); };

   // [name, anonymous?, setup, axe scope (null = whole document)] -- remove views whose feature was removed
   const VIEWS = [
     ["home", true, async () => {}, null],
     ["home-signup", true, click("#toggleMode"), null],
     ["feed", false, async (page) => { await page.waitForSelector("[data-open]"); await page.click("[data-open]"); await sleep(600); }, null],
     ["user-menu", false, click("#btnMenu"), "#userMenu"],
     ["dialog-new", false, click("#btnNew"), "#dlgNew"],
     ["dialog-org", false, openMenuItem("org"), "#dlgOrg"],
     ["dialog-account", false, openMenuItem("account"), "#dlgAccount"],
     ["dialog-mcp", false, openMenuItem("mcp"), "#dlgMcp"],
   ];

   function summarizeAxe(axe) {
     const tagsOnly = (arr) => (arr || []).map((r) => ({ id: r.id, tags: r.tags }));
     return { violations: axe.violations, incomplete: axe.incomplete, passes: tagsOnly(axe.passes), inapplicable: tagsOnly(axe.inapplicable) };
   }

   async function scanView(context, [name, anonymous, setup, scope], theme) {
     const page = await context.newPage();
     await page.setViewport({ width: 1280, height: 800 });
     // Reduced motion: the theme transition would otherwise be caught mid-way by the contrast rule
     await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-color-scheme", value: theme }]);
     await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 30000 });
     await page.waitForSelector(anonymous ? "#viewLogin:not([hidden])" : "#viewApp:not([hidden])", { timeout: 15000 });
     await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
     await setup(page);
     await page.evaluate(AXE);
     const axe = await page.evaluate((s) => window.axe.run(s ? { include: [s] } : document, { resultTypes: ["violations", "passes", "incomplete", "inapplicable"] }), scope);
     await page.setViewport({ width: 320, height: 640 });
     await sleep(300);
     const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
     await page.close();
     // report.js only uses the url as a label, but it must parse with new URL()
     return { url: `${BASE}/view/${name}--${theme}`, axe: summarizeAxe(axe), reflow320: { scrollWidth, ok: scrollWidth <= 320 }, lighthouse: { status: "skipped", reason: "view scan" } };
   }

   (async () => {
     await ensureAccount();
     const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
     const anon = await browser.createBrowserContext();
     const logged = await browser.createBrowserContext();
     const login = await logged.newPage();
     await login.goto(BASE + "/", { waitUntil: "networkidle0" });
     await login.type("#loginEmail", EMAIL);
     await login.type("#loginPwd", PASSWORD);
     await Promise.all([login.waitForSelector("#viewApp:not([hidden])", { timeout: 15000 }), login.click("#loginSubmit")]);
     await login.close();

     const results = [];
     for (const theme of ["light", "dark"]) {
       for (const view of VIEWS) {
         try { results.push(await scanView(view[1] ? anon : logged, view, theme)); }
         catch (err) { console.error(`${view[0]} (${theme}): ${err.message}`); }
       }
     }
     await browser.close();
     fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), root_dir: process.cwd(), browser: "puppeteer", urls: results.map((r) => r.url), results }, null, 2));
     console.log(OUT);
   })().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
   ```

   Run it with the scanner's dependencies on the module path:
   ```bash
   NODE_PATH=.claude/skills/accessibility/a11y-audit/deps/node_modules \
   TARGET_URL=$TARGET_URL AUDIT_EMAIL=$AUDIT_EMAIL AUDIT_PASSWORD=$AUDIT_PASSWORD \
   OUT="$A11Y_TMP/a11y-views.json" node "$A11Y_TMP/a11y-views.cjs"
   ```
   If a view fails (selector changed after a `/start` customisation), read `web/index.html`, fix the selector in the temporary script and re-run. Never skip a view silently: list skipped views in the report.

4. **Merge and report.** Merge the `results` arrays of `a11y-home.json` and `a11y-views.json` into one file (same top-level shape), then:
   ```bash
   node .claude/skills/accessibility/a11y-audit/scripts/report.js \
     --input "$A11Y_TMP/a11y-merged.json" \
     --output-dir "$A11Y_TMP/a11y-report" \
     --project-name "<project name>" \
     --runtime-url $TARGET_URL \
     --previous .claude/skills/accessibility/a11y-audit/last-audit.json   # only if it exists
   ```
   Copy the generated JSON to `.claude/skills/accessibility/a11y-audit/last-audit.json`. The markdown goes into the final report (Step 5). Add the `reflow320` results yourself: `report.js` ignores that field.

#### PerfIA Diagnostic IA-specific awareness

- **One file, shared chrome.** The header (`h1.logo`, `#btnNew`, `#btnTheme`, `#userMenu`) and the CSS tokens are common to every view: a violation there appears on every view. Report it once, as "affects every view".
- **Dynamic HTML.** Feed cards (`renderFeed`), comments (`loadComments`), the leaderboard (`renderLeaderboard`), the org card (`loadOrgCard`), the activity chart (`loadActivity`) and the key list (`loadKeys`) are built with template strings. Fix the template in the function, not the rendered DOM.
- **User content.** Titles, bodies and tags come from members: a missing heading or a very long word inside content is not a code bug, but overflow handling (`overflow-wrap: anywhere`) is.
- **Colour token failures** point to the token blocks at the top of `web/index.html` (`:root`, the `prefers-color-scheme: dark` block and `:root[data-theme="dark"]`), which must stay in sync.

### Step 4: Manual checklist on `web/index.html` (replaces static linting)

There is no JSX and no linter to run: read `web/index.html` and check each item. Report each as pass / fail / not applicable with the concept (element id, function, CSS rule) and the WCAG criterion.

**Structure and names**
- [ ] `<html lang="fr">` present; `<title>` set (also by `document.title = APP.name`). (SC 3.1.1, 2.4.2)
- [ ] Skip link `.skip` points to `#main` and becomes visible on focus. (SC 2.4.1)
- [ ] Heading order: `h1.logo` once; `h2` for the intro, login card, activity card, feed cards (`.item h2`), side cards (`aside h2`) and dialog titles; no skipped level inside dialogs. (SC 1.3.1)
- [ ] Landmarks: `header`, `main#main`, `aside` with an `aria-label`; the feed `section` has `aria-label="Fil"`. (SC 1.3.1)
- [ ] Every form control has an accessible name: `#loginName`, `#loginEmail`, `#loginPwd` (wrapped `<label for>`), `#q` (`aria-label`), the comment input built in `loadComments` (`aria-label`), `#fTitle`, `#fBody`, `#fTags`, `#oName`, `#oObjectives`, `#aName`, `#aEmail`, `#aNotify`, `#aOld`, `#aNew`, `#keyName`. (SC 1.3.1, 3.3.2, 4.1.2)
- [ ] Icon-only or ambiguous buttons are named: `#btnTheme` (label updated by `applyTheme`), vote buttons `[data-vote]`, `#tagClear`, tag buttons `[data-tag]`, `#btnNew` (visible text "Publier" matches its `aria-label`). (SC 2.5.3, 4.1.2)
- [ ] Decorative SVGs have `aria-hidden="true"`; the activity chart SVG has `role="img"` and an `aria-label` summary built in `loadActivity`. (SC 1.1.1)

**States and live regions**
- [ ] `aria-pressed` kept in sync on the `#sort` buttons (click handler) and on vote buttons (`renderFeed` and the vote handler). (SC 4.1.2)
- [ ] `aria-expanded` kept in sync on `#btnMenu` (`toggleMenu`) and on `[data-open]` ("Lire" / "Réduire"). (SC 4.1.2)
- [ ] `#btnMenu` declares `aria-haspopup="true"` (which means `menu`) while `#dropdown` is a plain list of buttons without `role="menu"`: either add the menu roles and keyboard pattern, or drop `aria-haspopup`. (SC 4.1.2)
- [ ] Status and error messages are announced: `#loginMsg` (`role="alert"`), `#toast` (`role="status"`, `aria-live="polite"`), `#liveStatus`, `#recStatus`, `#aiQuestions` (`role="status"`), `#liveLog` (`aria-live="polite"`), `.msg` on the OAuth page (`role="alert"`). Check that errors shown only through `toast()` (e.g. failed publish) are also understandable without seeing the toast. (SC 4.1.3, 3.3.1)
- [ ] The two-step delete (`[data-delete]`, armed for five seconds) updates both text and `aria-label`; five seconds is enough or can be extended. (SC 2.2.1, 3.3.4)
- [ ] `role="progressbar"` in `#meCard` has `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and a label. (SC 4.1.2)

**Dialogs and focus**
- [ ] All dialogs are native `<dialog>` opened with `showModal()` (focus trapped, Escape closes, background inert) and labelled with `aria-labelledby`. (SC 2.1.2, 2.4.3)
- [ ] Initial focus is sensible: `#fTitle` has `autofocus` in `#dlgNew`; other dialogs focus their first field. Focus returns to the trigger on close (check in the browser, including the menu items that open a dialog after `toggleMenu(false)`). (SC 2.4.3)
- [ ] User menu keyboard pattern: Enter/Space opens, Arrow keys move, Escape closes and returns focus to `#btnMenu` (keydown handler). (SC 2.1.1)
- [ ] Visible focus: `:focus-visible` outline uses `--focus` with 3 px; nothing sets `outline: none` without a replacement. (SC 2.4.7)
- [ ] No positive `tabindex`; every click handler is on a `button` or `a`, not a `div`. (SC 2.1.1)

**Colour and contrast (both themes)**
- [ ] Compute the token contrasts. Run from the project root:
  ```bash
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const html = readFileSync("web/index.html", "utf8");
  const block = (re) => Object.fromEntries([...(html.match(re)?.[1] ?? "").matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
  const light = block(/:root\s*\{([^}]*)\}/);
  const dark = { ...light, ...block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/) };
  const lum = (h) => h.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const PAIRS = [["ink","bg",4.5],["ink","card",4.5],["ink","card-2",4.5],["muted","bg",4.5],["muted","card",4.5],["muted","card-2",4.5],["primary-text","card",4.5],["link","card",4.5],["link","bg",4.5],["primary-ink","primary",4.5],["danger","card",4.5],["bg","ink",4.5],["line-strong","card",3],["line-strong","bg",3],["focus","card",3],["focus","bg",3],["primary","card",3],["accent","card",3]];
  for (const [name, t] of [["light", light], ["dark", dark]]) for (const [fg, bg, min] of PAIRS) { const r = ratio(t[fg], t[bg]); console.log(`${name} ${r >= min ? "ok  " : "FAIL"} --${fg} on --${bg}: ${r.toFixed(2)}:1 (min ${min})`); }'
  ```
  4.5:1 for text (SC 1.4.3), 3:1 for component borders, focus ring and meaningful graphics (SC 1.4.11). Also check that the `prefers-color-scheme: dark` block and `:root[data-theme="dark"]` hold the same values.
- [ ] Hardcoded colours outside the tokens (forbidden by the project rules, and not covered by the script): e.g. `#fff` text on `--danger` in `.dictate .btn.rec` (check it in the dark theme where `--danger` is light), `rgba()` shadows and `dialog::backdrop`. Compute them separately.
- [ ] Graphics: "today" bar of the activity chart uses `--accent` against `--card`; the legend "Aujourd'hui en orange, à droite" must not rely on colour alone. (SC 1.4.1, 1.4.11)
- [ ] The OAuth consent page (`authorizePage` in `oauth.js`) and the notification e-mails (`COLORS` in `notify.js`) carry their own colour values: compute them too.

**Motion, reflow, text**
- [ ] Animations and colour transitions are inside `@media (prefers-reduced-motion: no-preference)`; remaining unconditional transitions (`.btn`, `.item` box-shadow, `.vote button`, `.toast` opacity) are subtle. (SC 2.3.3, best practice)
- [ ] No horizontal scroll at 320 px on any view (`reflow320` from the runtime scan; in code-only mode, look for fixed widths: `dialog` uses `min(600px, 92vw)`, `.dropdown` `min-width: 240px`, `.toolbar input` `min-width: 160px`). (SC 1.4.10)
- [ ] Text spacing and 200% zoom: no fixed heights clipping text (`header .wrap` is 60 px high; check the header at 200%). (SC 1.4.4, 1.4.12)
- [ ] Autocomplete attributes on identity fields: `#loginEmail` (`username`), `#loginPwd` (`current-password` / `new-password` switched in the `#toggleMode` listener), `#aOld`, `#aNew`. (SC 1.3.5)
- [ ] Media: `#liveAudio` plays only after the user starts the interview; transcripts are shown in `#liveLog` / `#transcriptText`. (SC 1.4.2, 1.2.x not applicable to live interaction)

### Step 5: Present the report

Save it to `reports/quality/YYYY-MM-DD-accessibility.md` (when run via `/quality`) and summarise in the conversation:

```
## Accessibility Audit Report

### Summary
- Views scanned: X views x 2 themes (list skipped views and why)
- Runtime violations: X (Y critical, Z serious, W moderate)
- Reflow at 320 px: X views OK, Y overflow
- Manual checklist: X pass, Y fail, Z not applicable
- Delta: [if previous audit exists] +X new, -Y resolved, Z unchanged

### Critical & Serious Findings (fix these)
[Grouped by rule, with:]
- Rule name and WCAG criterion (e.g., "color-contrast -- SC 1.4.3")
- Impact level
- Views and theme affected ("every view, dark theme only")
- Element (selector or id) and the function or CSS rule that produces it
- Remediation guidance

### Moderate Findings (should fix)
[Same format]

### Minor Findings & Best Practices (nice to have)
[Same format]

### Token Contrast Table
[Output of the contrast script, both themes, plus hardcoded colours]

### Manual Checklist
[Each item: pass / fail / n.a., concept, criterion]

### WCAG 2.1 AA Compliance Matrix
[From report.js: pass / fail / manual / not applicable for the 50 criteria]

### Notes
- AI blocks (#realtime, #dictate) scanned only if an AI key is configured
- Member content (titles, bodies, tags) is not a code issue
- Automated checks do not replace testing with a real screen reader (NVDA, VoiceOver)
```

### Step 6: Offer to fix

> "Would you like me to fix any of these issues? I can address them by priority:
> 1. Fix all critical & serious issues
> 2. Fix specific issues (tell me which)
> 3. No fixes -- I'll keep the report for reference"

**Fix risk assessment -- apply to every finding:**

| Fix type | Risk | Why |
|----------|------|-----|
| Add a missing `aria-label` or `<label for>` | ✅ Safe | Purely additive, no visual change |
| Add `aria-hidden="true"` to a decorative SVG | ✅ Safe | Purely additive |
| Sync an `aria-pressed` / `aria-expanded` value in a handler | ✅ Safe | Reflects existing state |
| Add `autocomplete` attributes | ✅ Safe | Additive |
| Change a colour token value (`--muted`, `--accent`, `--line-strong`...) | ⚠️ Caution | Changes the look everywhere the token is used, in one theme; must keep both dark blocks identical and re-check every pair |
| Change heading levels in a template (`renderFeed`, dialogs) | ⚠️ Caution | CSS targets `h1`, `h2` and `.item h2`: styles may shift |
| Move focus (initial focus, return focus after closing a dialog) | ⚠️ Caution | Can change keyboard flow; test with Tab and Escape |
| Remove `aria-haspopup` from `#btnMenu` | ⚠️ Caution | Changes how screen readers announce the menu button |
| Turn `#dropdown` into a full ARIA menu (`role="menu"`, `menuitem`, roving focus) | 🚫 Risky | Incorrect ARIA is worse than no ARIA; every item and key handler must follow the pattern |
| Restructure landmarks or the `.landing` / `main .wrap` grid | 🚫 Risky | Affects every view and the responsive layout |
| Replace native `<dialog>` behaviour with custom focus trapping | 🚫 Risky | Native dialogs already handle focus and inertness; custom code easily breaks them |

**Fix risk gating (same rules as /quality):**
- ✅ Safe: apply directly
- ⚠️ Caution: apply, then summarize what changed
- 🚫 Risky: **STOP after Safe/Caution fixes.** Ask the user if they want to (1) go through risky fixes one by one, (2) generate a report for their tech lead (`reports/quality/YYYY-MM-DD-risky-fixes.md`), or (3) skip entirely. See /quality SKILL.md Step 9 for the full flow.

**When fixing:**
- Edit `web/index.html` only through its conventions: colours through tokens (both themes), French UI text without em dash, no build step, no new dependency.
- Templates built in JavaScript (`renderFeed`, `loadComments`, `renderLeaderboard`, `loadOrgCard`, `loadActivity`, `loadKeys`): fix the template string and keep `esc()` on every interpolated value.
- OAuth consent page: `authorizePage` in `pocketbase/pb_hooks/oauth.js` (hooks reload on the fly).
- E-mails: `COLORS` and `layout` in `pocketbase/pb_hooks/notify.js`.

**Fix flow (same as /quality Step 9):**
1. Apply all ✅ Safe and ⚠️ Caution fixes. Update `ai/WEB_PRACTICES.md` (or `.claude/practices.md` "Web" rules) with the patterns just introduced (e.g. menu ARIA convention, contrast values, focus return).
2. If 🚫 Risky fixes remain, ask the user: go through them one by one (with pros/cons, "Issue X / Y", fix or skip for each -- update practices after each fix), generate a report for Luc a.k.a. the professional fixer, or skip entirely.
3. **Automatically re-run the audit.** Show the delta.

## ARGUMENTS

- No argument: full audit (runtime views + manual checklist)
- `--static-only`: skip runtime scanning, only run the manual checklist and the contrast script
- `--runtime-only`: skip the manual checklist, only run the axe-core scans
- `--fix`: skip the report presentation, go straight to fixing all critical & serious issues
- `--delta`: only show what changed since last audit (requires previous last-audit.json)

$ARGUMENTS
