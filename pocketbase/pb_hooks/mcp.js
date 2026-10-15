/**
 * PerfIA Diagnostic IA : serveur MCP distant (Streamable HTTP, sans état) servi par PocketBase lui-même.
 *
 * Réservé à l'équipe : un membre (collection users) génère une clé personnelle depuis la page Équipe, valable
 * 30 jours, ou autorise un connecteur par OAuth. L'agent l'envoie en en-tête « Authorization: Bearer ak_… ».
 * Chaque outil agit ensuite au nom du membre, via l'API REST de PocketBase en boucle locale, donc avec exactement
 * ses droits (règles d'accès des collections). Module CommonJS chargé via require() depuis mcp.pb.js.
 */

const VERSION = "0.1.0";
const KEY_DAYS = 30;
// Taille maximale d'un lot JSON-RPC : borne le travail qu'une seule requête impose.
const MAX_BATCH = 20;
const KEY_PREFIX = "ak_";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

/* ---------- Clés d'API personnelles ---------- */
const hashKey = (key) => $security.sha256(String(key));

function createKey(app, user, name) {
  const key = KEY_PREFIX + $security.randomStringWithAlphabet(40, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  const col = app.findCollectionByNameOrId("api_keys");
  const rec = new Record(col);
  rec.set("user", user.id);
  rec.set("name", String(name || "Mon agent").slice(0, 80));
  rec.set("prefix", key.slice(0, 10));
  rec.set("hash", hashKey(key));
  rec.set("expires", new Date(Date.now() + KEY_DAYS * 86400000).toISOString());
  app.save(rec);
  return { key, id: rec.id, prefix: rec.get("prefix"), expires: String(rec.get("expires")) };
}

/** Retourne le membre porteur d'une clé valide, ou null. */
function userForKey(app, key) {
  if (!new RegExp(`^${KEY_PREFIX}[A-Za-z0-9]{40}$`).test(String(key || ""))) return null;
  let rec;
  try { rec = app.findFirstRecordByData("api_keys", "hash", hashKey(key)); } catch (_) { return null; }
  const exp = Date.parse(String(rec.get("expires")).replace(" ", "T"));
  if (!exp || exp < Date.now()) return null;
  let user;
  try { user = app.findRecordById("users", rec.get("user")); } catch (_) { return null; }
  // Même règle que la connexion (authRule) : newAuthToken() ne la vérifie pas, une adresse non confirmée n'ouvre rien.
  if (!user.get("verified")) return null;
  try { app.db().newQuery("UPDATE api_keys SET last_used = {:now} WHERE id = {:id}").bind({ now: new Date().toISOString().replace("T", " "), id: rec.id }).execute(); } catch (_) {}
  return user;
}

/* ---------- Client REST en boucle locale, avec le jeton du membre ---------- */
function client(app, user) {
  const base = String($os.getenv("APP_INTERNAL_URL") || "http://127.0.0.1:8090").replace(/\/+$/, "");
  const token = user.newAuthToken();
  const qs = (p) => Object.entries(p || {}).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const call = (method, path, body) => {
    const res = $http.send({ url: base + path, method, timeout: 20, headers: { Authorization: token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : "" });
    let data = null; try { data = res.raw ? JSON.parse(res.raw) : null; } catch (_) {}
    if (res.statusCode >= 400) {
      const first = data && data.data && Object.keys(data.data).length ? data.data[Object.keys(data.data)[0]] : null;
      throw new Error((data && data.message ? data.message : `HTTP ${res.statusCode}`) + (first && first.message ? ` (${Object.keys(data.data)[0]} : ${first.message})` : ""));
    }
    return data;
  };
  return {
    list: (col, p) => call("GET", `/api/collections/${col}/records?` + qs(Object.assign({ page: 1, perPage: 200 }, p))).items,
    count: (col, filter) => call("GET", `/api/collections/${col}/records?` + qs({ page: 1, perPage: 1, fields: "id", filter })).totalItems,
    one: (col, id, p) => call("GET", `/api/collections/${col}/records/${encodeURIComponent(id)}?` + qs(p)),
    update: (col, id, body) => call("PATCH", `/api/collections/${col}/records/${encodeURIComponent(id)}`, body),
  };
}

/* ---------- Outils ---------- */
const D = () => require(`${__hooks}/domain.js`);
const REF = () => require(`${__hooks}/referentiel.js`);
const S = () => require(`${__hooks}/scoring.js`);
const q = (s) => String(s).replace(/["\\]/g, "");
const day = (d) => { const t = Date.parse(String(d).replace(" ", "T")); return isNaN(t) ? String(d) : new Date(t).toLocaleDateString("fr-FR"); };
const text = (s) => ({ content: [{ type: "text", text: s }] });
const need = (a, k) => { if (a[k] === undefined || a[k] === null || a[k] === "") throw new Error(`Paramètre manquant : ${k}`); return a[k]; };
const lbl = (list, code) => D().labelOf(list, code);

function sessionByCode(c, code) {
  const rows = c.list("sessions", { filter: `code = "${q(String(code).toLowerCase())}"`, perPage: 1 });
  if (!rows.length) throw new Error(`Session inconnue : « ${code} ».`);
  return rows[0];
}
const levelsLine = (l) => l ? `IA ${l.ia || "?"} · Données ${l.donnees || "?"} · Cadre ${l.cadre || "?"}` : "niveaux inconnus";
function diagLine(d) {
  const ref = REF(), r = d.result || {};
  const top = ((r.quadrants || {}).tester || []).slice(0, 2).map((n) => r.cases[n - 1].label);
  return [
    `### ${[d.firstname, d.lastname].filter(Boolean).join(" ") || "(anonymisé)"} · ${d.company || "?"}`,
    `id: ${d.id} · ${day(d.created)} · ${lbl(ref.maillons, d.maillon)} · ${lbl(ref.fonctions, d.role) || "fonction ?"}`,
    `e-mail : ${d.email || "?"}${d.phone ? ` · tél. ${d.phone}` : ""} · recontact ${d.consent_contact ? "accepté" : "non"} · partage ${d.consent_partner ? "accepté" : "non"}`,
    `${levelsLine(d.levels)} · ${((r.cases || []).length)} cas souhaité(s)${top.length ? ` · à tester : ${top.join(" ; ")}` : ""}`,
    `suivi : ${D().LEAD_STATUSES[d.lead_status] || d.lead_status || "?"}${d.notes ? ` · notes : ${d.notes}` : ""}`,
  ].join("\n");
}

function tools() {
  const statuses = Object.keys(D().LEAD_STATUSES);
  return [
    { name: "list_sessions", title: "Lister les sessions", description: "Liste les sessions (une par intervention), avec leur statut et leur nombre de diagnostics.",
      inputSchema: { type: "object", properties: { status: { type: "string", enum: ["brouillon", "ouverte", "fermee"] } } },
      run: (c, me, a) => {
        const rows = c.list("sessions", { sort: "-date,-created", filter: a.status ? `status = "${q(a.status)}"` : "" });
        if (!rows.length) return text("Aucune session.");
        return text(rows.map((s) => `- ${s.code} · ${s.title} · ${s.date ? day(s.date) : "sans date"} · ${D().SESSION_STATUSES[s.status] || s.status} · ${c.count("diagnostics", `session = "${s.id}"`)} diagnostic(s)`).join("\n"));
      } },
    { name: "session_stats", title: "Statistiques d'une session", description: "Agrégats anonymes d'une session : répartition des niveaux par axe, question éclair, cas d'usage les plus choisis.",
      inputSchema: { type: "object", required: ["code"], properties: { code: { type: "string", description: "Code court de la session, ex. « ibc »" } } },
      run: (c, me, a) => {
        const s = sessionByCode(c, need(a, "code"));
        const rows = c.list("diagnostics", { filter: `session = "${s.id}"`, fields: "levels,pulse,cases", perPage: 500 })
          .map((d) => ({ levels: d.levels || {}, pulse: d.pulse || null, cases: d.cases || [] }));
        const st = S().aggregate(REF(), rows, { top: 10 });
        if (!st.ready) return text(`${s.title} : ${st.n} réponse(s), il en faut ${st.seuil} pour afficher des agrégats.`);
        const axes = Object.keys(st.axes).map((k) => `- ${st.axes[k].label} : moyenne ${st.axes[k].mean} ; répartition niveaux 1 à 5 : ${st.axes[k].dist.join(" / ")}`).join("\n");
        const base = s.baseline && typeof s.baseline === "object" ? `\nRéférence : ${JSON.stringify(s.baseline)}` : "";
        return text(`${s.title} : ${st.n} diagnostic(s).${base}\n${axes}\n- Question éclair : moyenne ${st.pulse.mean} (${st.pulse.n} réponse(s))\n\nCas les plus choisis :\n${st.top.map((t, i) => `${i + 1}. ${t.label} : ${t.count} fois, priorité moyenne ${t.prio_mean}, effort ${t.effort}`).join("\n")}`);
      } },
    { name: "list_diagnostics", title: "Lister les diagnostics", description: "Liste les diagnostics (prospects), du plus récent au plus ancien. Filtres : session, statut de suivi, recontact accepté.",
      inputSchema: { type: "object", properties: {
        session: { type: "string", description: "Code de session ; absent : toutes les sessions" },
        lead_status: { type: "string", enum: statuses },
        consent_contact: { type: "boolean", description: "true : seulement ceux qui acceptent d'être recontactés" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 30 } } },
      run: (c, me, a) => {
        const f = [];
        if (a.session) f.push(`session = "${sessionByCode(c, a.session).id}"`);
        if (a.lead_status) f.push(`lead_status = "${q(a.lead_status)}"`);
        if (a.consent_contact === true) f.push("consent_contact = true");
        const rows = c.list("diagnostics", { filter: f.join(" && "), sort: "-created", perPage: Math.min(100, Math.max(1, a.limit || 30)) });
        return text(rows.length ? rows.map(diagLine).join("\n\n") : "Aucun diagnostic.");
      } },
    { name: "get_diagnostic", title: "Lire un diagnostic", description: "Affiche un diagnostic complet : niveaux et étapes par axe, cas d'usage avec effort, priorité et quadrant, offres proposées.",
      inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      run: (c, me, a) => {
        const d = c.one("diagnostics", String(need(a, "id")));
        const r = d.result || {};
        const quad = Object.fromEntries((REF().quadrants || []).map((x) => [x.code, x.label]));
        const axes = (r.axes || []).map((x) => `- ${x.label} : ${x.niveau} (${x.n}), ${x.titre}. Étapes : ${x.steps.join(" ")}`).join("\n");
        const cases = (r.cases || []).map((x) => `${x.num}. ${x.label} · ${REF().types[x.type].label} · effort ${x.effort} · priorité ${x.priority} · ${quad[x.quadrant]}`).join("\n");
        return text(`${diagLine(d)}\n\nAxes :\n${axes}\n\nCas souhaités :\n${cases || "aucun"}${(r.acquis || []).length ? `\n\nDéjà en place : ${r.acquis.map((x) => x.label).join(" ; ")}` : ""}\n\nOffres proposées : ${(r.offres || []).map((o) => o.titre).join(" ; ")}${d.free_text ? `\n\nTâche libre : ${d.free_text}` : ""}`);
      } },
    { name: "set_lead_status", title: "Mettre à jour le suivi d'un prospect", description: "Change le statut de suivi d'un diagnostic et, si besoin, ses notes. N'envoie aucun message.",
      inputSchema: { type: "object", required: ["id", "lead_status"], properties: { id: { type: "string" }, lead_status: { type: "string", enum: statuses }, notes: { type: "string", maxLength: 2000 } } },
      run: (c, me, a) => {
        const body = { lead_status: String(need(a, "lead_status")) };
        if (a.notes !== undefined) body.notes = String(a.notes).slice(0, 2000);
        const d = c.update("diagnostics", String(need(a, "id")), body);
        return text(`Suivi de ${d.firstname || "?"} (${d.company || "?"}) : ${D().LEAD_STATUSES[d.lead_status]}.`);
      } },
  ];
}

function prompts() {
  return [
    { name: "preparer_relances", title: "Préparer les relances d'une session", description: "Rédige des brouillons de relance personnalisés pour les participants d'une session qui acceptent d'être recontactés.",
      arguments: [{ name: "session", description: "Code de la session", required: true }],
      get: (a) => ({ description: "Préparer les relances", messages: [{ role: "user", content: { type: "text", text:
        `Appelle list_diagnostics avec session « ${a.session} » et consent_contact true. Pour chaque participant, rédige un brouillon de relance court (6 lignes au plus), en vouvoyant, qui rappelle l'intervention, cite le cas d'usage « à tester tout de suite » le mieux placé et propose un échange de 30 minutes. Pas de gain chiffré, pas d'envoi : présente les brouillons, puis propose de passer leur suivi à « contacte » avec set_lead_status une fois envoyés.` } }] }) },
  ];
}

/* ---------- Textes de découverte ---------- */
function baseURL(app, e) {
  const u = String(app.settings().meta.appURL || "").replace(/\/+$/, "");
  if (u && !/localhost|127\.0\.0\.1/.test(u)) return u;
  // Repli sans URL d'application configurée : l'en-tête n'est accepté que s'il vaut http ou https.
  const proto = String(e.request.header.get("X-Forwarded-Proto") || "").split(",")[0].trim().toLowerCase() === "https" ? "https" : "http";
  return `${proto}://${e.request.host}`;
}

const slug = (s) => String(s || "app").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";

function llmsTxt(base, appName) {
  return `# ${appName}

> ${appName} est le diagnostic de maturité IA PerfIA pour la filière forêt-bois (Kosmio × Xylofutur). Les participants
> répondent sans compte, sur mobile ; l'équipe suit les sessions et les prospects. Interface en français.

## Serveur MCP (réservé à l'équipe)

- Adresse : ${base}/mcp
- Transport : MCP Streamable HTTP, sans état (POST JSON-RPC ; GET renvoie la description, 405 pour un flux SSE).
- Authentification, au choix :
  - en-tête \`Authorization: Bearer <clé>\` ; la clé commence par \`${KEY_PREFIX}\` et vaut ${KEY_DAYS} jours ;
  - OAuth 2.1 (code + PKCE, enregistrement dynamique) : métadonnées sur ${base}/.well-known/oauth-authorization-server.
- Description lisible par machine : ${base}/.well-known/mcp.json

### Obtenir une clé

1. Ouvrir ${base}/equipe.html et se connecter avec son compte d'équipe.
2. « Connecter un agent IA » > « Générer une clé ».
3. Copier la clé affichée (elle ne l'est qu'une fois) et la coller dans la conversation avec l'agent.

### Configurer l'agent

- Claude Code : \`claude mcp add --transport http ${slug(appName)} ${base}/mcp --header "Authorization: Bearer <clé>"\`
- Autres clients MCP : URL ${base}/mcp, en-tête HTTP Authorization: Bearer <clé>.

### Outils

${tools().map((t) => t.name).join(", ")}. Prompt : ${prompts().map((p) => p.name).join(", ")}.
`;
}

function helpJSON(base, appName) {
  return {
    name: slug(appName), title: `${appName} MCP`, version: VERSION,
    description: `Serveur MCP de ${appName} : sessions, diagnostics et suivi des prospects, réservé à l'équipe.`,
    url: `${base}/mcp`, transport: "streamable-http", stateless: true,
    authentication: { type: "bearer", header: "Authorization: Bearer <clé>", key_prefix: KEY_PREFIX, validity_days: KEY_DAYS,
      how_to_get_key: `Se connecter sur ${base}/equipe.html, « Connecter un agent IA » > « Générer une clé ».` },
    oauth: { authorization_server: `${base}/.well-known/oauth-authorization-server`, flows: ["authorization_code+pkce"], dynamic_client_registration: true },
    tools: tools().map((t) => t.name), prompts: prompts().map((p) => p.name),
    documentation: `${base}/llms.txt`,
  };
}

/* ---------- JSON-RPC ---------- */
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });
const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });

function handleMessage(app, msg, ctx) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcError(msg && msg.id, -32600, "Requête JSON-RPC invalide.");
  const { id, method } = msg, params = msg.params || {};
  const isNotification = id === undefined;
  try {
    switch (method) {
      case "initialize": {
        const asked = String(params.protocolVersion || "");
        return rpcResult(id, { protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0], capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
          serverInfo: { name: slug(ctx.appName), title: `${ctx.appName} MCP`, version: VERSION }, instructions: D().mcpInstructions(ctx.appName, ctx.me.name) });
      }
      case "ping": return rpcResult(id, {});
      case "tools/list": return rpcResult(id, { tools: tools().map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema })) });
      case "tools/call": {
        const tool = tools().find((t) => t.name === params.name);
        if (!tool) return rpcError(id, -32602, `Outil inconnu : ${params.name}`);
        try { return rpcResult(id, tool.run(ctx.client(), ctx.me, params.arguments || {}, ctx)); }
        catch (err) { return rpcResult(id, { content: [{ type: "text", text: `Erreur : ${err && err.message ? err.message : err}` }], isError: true }); }
      }
      case "prompts/list": return rpcResult(id, { prompts: prompts().map((p) => ({ name: p.name, title: p.title, description: p.description, arguments: p.arguments })) });
      case "prompts/get": {
        const p = prompts().find((x) => x.name === params.name);
        if (!p) return rpcError(id, -32602, `Prompt inconnu : ${params.name}`);
        return rpcResult(id, p.get(params.arguments || {}));
      }
      case "resources/list": return rpcResult(id, { resources: [] });
      case "resources/templates/list": return rpcResult(id, { resourceTemplates: [] });
      default:
        if (isNotification || method.startsWith("notifications/")) return null;
        return rpcError(id, -32601, `Méthode inconnue : ${method}`);
    }
  } catch (err) {
    return rpcError(id, -32603, `Erreur interne : ${err && err.message ? err.message : err}`);
  }
}

/** Traite un corps POST /mcp (message ou lot). Retourne { status, body } ; body null = 202 sans contenu. */
function handleBody(app, raw, ctx) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { return { status: 400, body: rpcError(null, -32700, "JSON invalide.") }; }
  if (Array.isArray(parsed)) {
    if (!parsed.length || parsed.length > MAX_BATCH) return { status: 400, body: rpcError(null, -32600, `Lot JSON-RPC : entre 1 et ${MAX_BATCH} messages.`) };
    const out = parsed.map((m) => handleMessage(app, m, ctx)).filter(Boolean);
    return out.length ? { status: 200, body: out } : { status: 202, body: null };
  }
  const res = handleMessage(app, parsed, ctx);
  return res ? { status: 200, body: res } : { status: 202, body: null };
}

module.exports = { VERSION, KEY_DAYS, MAX_BATCH, KEY_PREFIX, createKey, userForKey, client, handleBody, llmsTxt, helpJSON, baseURL, tools, prompts };
