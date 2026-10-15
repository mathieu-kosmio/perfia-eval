/**
 * PerfIA Diagnostic IA : OAuth 2.1 devant le serveur MCP, pour les clients qui ne savent pas envoyer une clé (connecteurs
 * claude.ai, Cowork, ChatGPT…). Code d'autorisation + PKCE (S256), enregistrement dynamique des clients (RFC 7591),
 * métadonnées RFC 8414 et RFC 9728. À la fin du flux, le jeton d'accès est une clé personnelle ordinaire
 * (api_keys, 30 jours, révocable dans « Mon compte ») : le serveur MCP ne fait aucune différence.
 * Module CommonJS chargé via require() depuis oauth.pb.js.
 */

const CODE_TTL_S = 600;
const SCOPE = "diagnostics";

const noStore = (e) => { e.response.header().set("Cache-Control", "no-store"); e.response.header().set("Pragma", "no-cache"); };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** base64url d'une empreinte SHA-256 donnée en hexadécimal ($security.sha256). */
function hexToB64url(hex) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = []; for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < bytes.length ? A[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? A[n & 63] : "=");
  }
  return out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const pkceOk = (verifier, challenge) => !!verifier && hexToB64url($security.sha256(String(verifier))) === String(challenge);

// Adresse de retour acceptée : https, ou http sur la boucle locale ; sans fragment, identifiants ni joker, 512 caractères au plus.
const isRedirectOk = (u) => u.length <= 512 && !/[\s#*]/.test(u)
  && (/^https:\/\/[a-z0-9.-]+(:\d+)?(\/|\?|$)/i.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|\?|$)/.test(u));
const redirectHost = (u) => { const m = /^https?:\/\/([^/:?]+)/i.exec(String(u || "")); return m ? m[1].toLowerCase() : ""; };
// Hôtes des connecteurs connus : pour tout autre, la page d'autorisation affiche un avertissement.
const KNOWN_REDIRECT_HOSTS = ["claude.ai", "claude.com", "chatgpt.com", "chat.openai.com", "localhost", "127.0.0.1"];
const isKnownHost = (h) => KNOWN_REDIRECT_HOSTS.some((k) => h === k || h.endsWith("." + k));

/* ---------- Métadonnées de découverte ---------- */
function serverMetadata(base) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
    service_documentation: `${base}/llms.txt`,
  };
}
function resourceMetadata(base) {
  return { resource: `${base}/mcp`, authorization_servers: [base], bearer_methods_supported: ["header"], scopes_supported: [SCOPE], resource_name: "MCP", resource_documentation: `${base}/llms.txt` };
}

/* ---------- Clients (enregistrement dynamique) ---------- */
function registerClient(app, body) {
  const raw = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!raw.length || raw.length > 5 || !raw.every(isRedirectOk)) {
    throw new BadRequestError("redirect_uris : une à cinq adresses https (ou http://localhost), sans fragment, identifiants ni joker.");
  }
  const uris = raw;
  const rec = new Record(app.findCollectionByNameOrId("oauth_clients"));
  rec.set("client_id", $security.randomStringWithAlphabet(32, "abcdefghijklmnopqrstuvwxyz0123456789"));
  rec.set("name", String(body.client_name || "Agent").slice(0, 80));
  rec.set("redirect_uris", JSON.stringify(uris));
  app.save(rec);
  return { client_id: rec.get("client_id"), client_id_issued_at: Math.floor(Date.now() / 1000), client_name: rec.get("name"), redirect_uris: uris,
    token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"], scope: SCOPE };
}
function findClient(app, clientId) {
  try { return app.findFirstRecordByData("oauth_clients", "client_id", String(clientId || "")); } catch (_) { return null; }
}
/** Vérifie client et redirect_uri ; retourne { client, redirectUri } ou lève. */
function checkClient(app, clientId, redirectUri) {
  const client = findClient(app, clientId);
  if (!client) throw new BadRequestError("client_id inconnu : le client doit d'abord s'enregistrer sur /oauth/register.");
  let list = [];
  try { const v = client.get("redirect_uris"); list = (Array.isArray(v) ? v : JSON.parse(String(v || "[]"))).map(String); } catch (_) { list = []; }
  const ru = String(redirectUri || "") || (list.length === 1 ? list[0] : "");
  if (!list.includes(ru)) throw new BadRequestError("redirect_uri absent de la liste enregistrée pour ce client.");
  return { client, redirectUri: ru };
}

/* ---------- Codes d'autorisation (mémoire, 10 minutes) ---------- */
const codeKey = (code) => "oauth:code:" + $security.sha256(String(code));
function issueCode(app, data) {
  const code = $security.randomStringWithAlphabet(40, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  app.store().set(codeKey(code), JSON.stringify(Object.assign({ exp: Date.now() + CODE_TTL_S * 1000 }, data)));
  return code;
}
function consumeCode(app, code) {
  const k = codeKey(code);
  const raw = app.store().get(k);
  if (!raw) return null;
  app.store().remove(k);
  const d = JSON.parse(String(raw));
  return d.exp > Date.now() ? d : null;
}
const withQuery = (uri, params) => uri + (uri.includes("?") ? "&" : "?") + Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

/* ---------- Page d'autorisation ---------- */
function authorizePage(ctx) {
  // ctx = { appName, client: { name }, params: { client_id, redirect_uri, state, code_challenge, scope }, error? }
  const p = ctx.params || {};
  const data = esc(JSON.stringify(p));
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autoriser un agent · ${esc(ctx.appName)}</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  :root { --bg:#f3f4f6; --card:#ffffff; --card-2:#f9fafb; --ink:#111827; --muted:#4b5563; --line:#d1d5db; --accent:#00705f; --accent-ink:#00705f; --focus:#00705f; }
  @media (prefers-color-scheme: dark) { :root { --bg:#14161a; --card:#1d2026; --card-2:#262a31; --ink:#e8e9ec; --muted:#a3a8b3; --line:#3a3f48; --accent:#00705f; --accent-ink:#5fd8c0; --focus:#5fd8c0; } }
  * { box-sizing:border-box } body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; display:flex; min-height:100vh; align-items:center; justify-content:center; padding:24px }
  .card { width:100%; max-width:440px; background:var(--card); border-radius:12px; padding:28px 30px 24px }
  .logo { display:flex; align-items:center; gap:9px; font-size:20px; font-weight:700; margin:0 0 18px; color:var(--accent-ink) } .logo img { width:30px; height:30px; object-fit:contain }
  .kicker { font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--accent-ink); margin:0 0 6px }
  h1 { font-weight:600; font-size:22px; line-height:1.2; margin:0 0 12px }
  p { margin:0 0 12px } .muted { color:var(--muted); font-size:13px }
  label { display:block; font-size:13px; color:var(--muted); margin:10px 0 4px } input { width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:6px; background:var(--card-2); color:var(--ink); font:inherit }
  input:focus { outline:2px solid var(--focus); outline-offset:1px }
  .row { display:flex; gap:10px; justify-content:flex-end; margin-top:18px } button { font:inherit; font-weight:600; padding:10px 16px; border-radius:8px; border:1px solid var(--line); background:var(--card-2); color:var(--ink); cursor:pointer }
  button.primary { background:var(--accent); border-color:var(--accent); color:#ffffff } .msg { color:#9e2f2f; font-size:13px; min-height:1.2em; margin:8px 0 0 } [hidden] { display:none !important }
  ul { margin:0 0 14px; padding-left:18px } li { margin:2px 0 }
  .warn { border-left:4px solid #9e2f2f; padding:8px 12px; background:var(--card-2); font-size:14px }
</style></head>
<body><main class="card" id="app" data-params="${data}">
  <p class="logo"><img src="/favicon.svg" alt="" width="30" height="30">${esc(ctx.appName)}</p>
  ${ctx.error ? `<p class="kicker">Demande refusée</p><h1>Impossible d'autoriser cet agent</h1><p>${esc(ctx.error)}</p><p class="muted">Fermez cette fenêtre et relancez la connexion depuis l'agent.</p>` : `
  <p class="kicker">Un agent demande l'accès</p>
  <h1>Autoriser <span id="clientName">${esc(ctx.client.name)}</span> à accéder à votre espace ?</h1>
  <p class="${isKnownHost(redirectHost(p.redirect_uri)) ? "muted" : "warn"}">L'accès sera transmis à <strong>${esc(redirectHost(p.redirect_uri))}</strong>.${isKnownHost(redirectHost(p.redirect_uri)) ? "" : " Cette adresse n'est pas celle d'un connecteur connu : n'autorisez que si vous venez de lancer vous-même la connexion depuis cet agent. Le nom affiché est choisi par le demandeur."}</p>
  <p class="muted">Il agira en votre nom, avec vos droits d'équipe : lire les sessions et les diagnostics, mettre à jour le suivi des prospects. L'accès vaut 30 jours et se révoque depuis la page Équipe.</p>
  <div id="login" hidden>
    <label for="email">Adresse e-mail professionnelle</label><input id="email" type="email" autocomplete="username" required>
    <label for="password">Mot de passe</label><input id="password" type="password" autocomplete="current-password" required>
  </div>
  <p id="who" class="muted" hidden></p>
  <p class="msg" id="msg" role="alert"></p>
  <div class="row"><button type="button" id="deny">Refuser</button><button type="button" class="primary" id="ok">Autoriser</button></div>`}
</main>
<script src="https://cdn.jsdelivr.net/npm/pocketbase@0.28.1/dist/pocketbase.umd.js" integrity="sha384-Pr74Q4nJqBcqXYMrsOS8tSw8t8N0Nayn7pWqFRdz9MsePI7uo55HNdxwrCcIRD8e" crossorigin="anonymous"></script>
<script>
(function () {
  const root = document.getElementById("app"); if (!document.getElementById("ok")) return;
  const P = JSON.parse(root.dataset.params), pb = new PocketBase(location.origin), $ = (s) => document.querySelector(s);
  const msg = (t) => { $("#msg").textContent = t || ""; };
  function refresh() { const ok = pb.authStore.isValid && pb.authStore.record; $("#login").hidden = !!ok; $("#who").hidden = !ok; if (ok) $("#who").textContent = "Connecté en tant que " + (pb.authStore.record.name || pb.authStore.record.email) + "."; }
  refresh();
  $("#deny").onclick = () => { location.replace(P.redirect_uri + (P.redirect_uri.includes("?") ? "&" : "?") + "error=access_denied" + (P.state ? "&state=" + encodeURIComponent(P.state) : "")); };
  $("#ok").onclick = async () => {
    msg(""); $("#ok").disabled = true;
    try {
      if (!(pb.authStore.isValid && pb.authStore.record)) {
        await pb.collection("users").authWithPassword($("#email").value.trim(), $("#password").value);
      }
      const r = await pb.send("/oauth/approve", { method: "POST", body: { client_id: P.client_id, redirect_uri: P.redirect_uri, state: P.state, code_challenge: P.code_challenge, scope: P.scope } });
      location.replace(r.redirect);
    } catch (e) { msg((e && e.response && e.response.message) || (e && e.message) || "Échec de la connexion."); $("#ok").disabled = false; }
  };
})();
</script></body></html>`;
}

module.exports = { SCOPE, noStore, isRedirectOk, redirectHost, isKnownHost, CODE_TTL_S, pkceOk, serverMetadata, resourceMetadata, registerClient, findClient, checkClient, issueCode, consumeCode, withQuery, authorizePage, esc };
