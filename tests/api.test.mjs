/**
 * PerfIA Diagnostic IA : tests d'intégration contre une instance PocketBase jetable (lancée par scripts/test.sh).
 *
 * Couvre : schéma, inscriptions fermées, sessions (valeurs par défaut, clé animateur masquée, lecture publique),
 * dépôt d'un diagnostic (validation, recalcul serveur, champ piège, session fermée, consentements), rapport par
 * jeton, isolement des données nominatives, vue salle (clé, seuil de 3 réponses), export CSV (accès, injection de
 * formule), serveur MCP de l'équipe, relance après session (valeurs par défaut, aperçu réservé à l'équipe,
 * destinataires, contenu et seuil de 3 réponses), en-têtes de sécurité, limitation de débit.
 *
 * Aucune dépendance : node:test et fetch. Lancer avec `make test`.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const requireCjs = createRequire(import.meta.url);

const BASE = process.env.PB_URL || "http://127.0.0.1:8090";
const ADMIN = { identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD };
const RUN = randomBytes(3).toString("hex");
const REF = JSON.parse(readFileSync(new URL("../web/content/referentiel.json", import.meta.url), "utf8"));

/* ---------- Petit client HTTP ---------- */
async function api(method, path, { token, body, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = token;
  let payload;
  if (body !== undefined) { h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
  const text = await res.text();
  let data = text;
  if (!raw) { try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; } }
  return { status: res.status, data, headers: res.headers };
}
const records = (col) => `/api/collections/${col}/records`;
async function mcp(key, method, params, id = 1) {
  return api("POST", "/mcp", { token: key ? `Bearer ${key}` : undefined, body: { jsonrpc: "2.0", id, method, params } });
}

/** Un diagnostic complet et valide pour un bureau d'études ; `over` remplace des champs. */
const diag = (over = {}) => ({
  firstname: "Camille", lastname: "Durand", company: "BE Charpente Sud", email: `camille.${RUN}@exemple.fr`,
  role: "be_technique", maillon: "bureau_etudes", size: "6-20",
  levels: { ia: 2, donnees: 2, cadre: 1 }, pulse: 3,
  cases: [
    { code: "SKILL_TRV_LIRE_DCE", state: "veut", priority: 5 },
    { code: "SKILL_BET_VEILLE_NORMATIVE", state: "veut", priority: 4 },
    { code: "SKILL_TRV_TRI_MAILS", state: "deja" },
  ],
  consent_processing: true, consent_contact: true, consent_partner: true, consent_news: false,
  duration_s: 240, source: "test",
  ...over,
});

/* ---------- Fixtures ---------- */
let admin, staff, staffUser, session, sessionKey, token;
const code = `ibc-${RUN}`;

before(async () => {
  const r = await api("POST", "/api/collections/_superusers/auth-with-password", { body: ADMIN });
  assert.equal(r.status, 200, "authentification superutilisateur");
  admin = r.data.token;
  const email = `equipe.${RUN}@kosm.test`;
  const u = await api("POST", records("users"), { token: admin, body: { email, password: "password-123", passwordConfirm: "password-123", name: "Équipe", verified: true } });
  assert.equal(u.status, 200, `compte d'équipe : ${JSON.stringify(u.data)}`);
  const l = await api("POST", "/api/collections/users/auth-with-password", { body: { identity: email, password: "password-123" } });
  assert.equal(l.status, 200);
  staff = l.data.token;
  staffUser = l.data.record;
});

/* ---------- Schéma et comptes ---------- */
test("la migration importe les collections et nomme l'application", async () => {
  const r = await api("GET", "/api/collections?perPage=100", { token: admin });
  const names = r.data.items.map((c) => c.name);
  for (const n of ["users", "sessions", "diagnostics", "api_keys", "oauth_clients"]) assert.ok(names.includes(n), n);
  for (const n of ["organisations", "items", "votes", "comments", "teams"]) assert.ok(!names.includes(n), `${n} retirée`);
  const s = await api("GET", "/api/settings", { token: admin });
  assert.equal(s.data.meta.appName, "PerfIA Diagnostic IA");
});

test("les inscriptions sont fermées : seul un superutilisateur crée un compte d'équipe", async () => {
  const r = await api("POST", records("users"), { body: { email: `intrus.${RUN}@exemple.fr`, password: "password-123", passwordConfirm: "password-123", name: "Intrus" } });
  assert.equal(r.status, 403);
});

test("un membre de l'équipe ne voit que son propre compte", async () => {
  const r = await api("GET", records("users"), { token: staff });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.items.map((u) => u.id), [staffUser.id]);
});

/* ---------- Sessions ---------- */
test("l'équipe crée une session : code en minuscules, valeurs par défaut, clé animateur masquée", async () => {
  const r = await api("POST", records("sessions"), { token: staff, body: {
    code: code.toUpperCase(), title: "Restitution des ateliers IBC", default_maillon: "bureau_etudes",
    baseline: { label: "Atelier IBC 25/09", usage_ia: 2.1, clarte: 2.3 }, partner_consent_label: "J'accepte que mes réponses soient transmises à l'IBC.",
  } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  session = r.data;
  assert.equal(session.code, code);
  assert.equal(session.status, "brouillon");
  assert.equal(session.flow, "complet");
  assert.equal(session.identity_position, "debut");
  assert.equal(session.presenter_key, undefined, "clé animateur jamais renvoyée par l'API");
  const su = await api("GET", `${records("sessions")}/${session.id}`, { token: admin });
  sessionKey = su.data.presenter_key;
  assert.match(sessionKey, /^[a-z0-9]{10}$/);
});

test("une session refuse un maillon inconnu", async () => {
  const r = await api("POST", records("sessions"), { token: staff, body: { code: `x-${RUN}`, title: "Essai", default_maillon: "chaudronnerie" } });
  assert.equal(r.status, 400);
});

test("un anonyme ne liste ni ne lit les sessions par l'API générique", async () => {
  const l = await api("GET", records("sessions"));
  assert.equal(l.status, 200);
  assert.equal(l.data.items.length, 0);
  const v = await api("GET", `${records("sessions")}/${session.id}`);
  assert.equal(v.status, 404);
});

test("une session en brouillon est introuvable ; ouverte, elle expose ses seuls champs publics", async () => {
  assert.equal((await api("GET", `/api/app/sessions/${code}`)).status, 404);
  const u = await api("PATCH", `${records("sessions")}/${session.id}`, { token: staff, body: { status: "ouverte" } });
  assert.equal(u.status, 200);
  const r = await api("GET", `/api/app/sessions/${code}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.title, "Restitution des ateliers IBC");
  assert.equal(r.data.default_maillon, "bureau_etudes");
  assert.equal(r.data.presenter_key, undefined);
  assert.equal(r.data.notes, undefined);
  assert.equal(r.data.baseline, undefined, "la mesure de référence est réservée à la vue salle");
});

test("le lien court redirige vers le parcours de la session", async () => {
  const r = await api("GET", `/s/${code}`, { raw: true });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), `/?s=${code}`);
});

/* ---------- Dépôt d'un diagnostic ---------- */
test("un diagnostic sans consentement de traitement est refusé", async () => {
  const r = await api("POST", "/api/app/diagnostics", { body: diag({ consent_processing: false }) });
  assert.equal(r.status, 400);
  assert.ok(r.data.data.consent_processing);
});

test("un diagnostic incomplet renvoie un message par champ", async () => {
  const r = await api("POST", "/api/app/diagnostics", { body: diag({ email: "pas-une-adresse", levels: { ia: 2, donnees: 9 } }) });
  assert.equal(r.status, 400);
  assert.ok(r.data.data.email);
  assert.ok(r.data.data["levels.donnees"]);
  assert.ok(r.data.data["levels.cadre"]);
});

test("un cas d'usage hors du catalogue du maillon est refusé", async () => {
  const r = await api("POST", "/api/app/diagnostics", { body: diag({ cases: [{ code: "SKILL_SCI_SECHAGE", state: "veut", priority: 5 }] }) });
  assert.equal(r.status, 400);
  assert.ok(r.data.data.cases);
});

test("le champ piège arrête les robots", async () => {
  const r = await api("POST", "/api/app/diagnostics", { body: diag({ website: "http://spam.example" }) });
  assert.equal(r.status, 400);
});

test("le serveur recalcule le résultat et ignore celui du client", async () => {
  const r = await api("POST", "/api/app/diagnostics", { body: diag({ result: { offres: [{ titre: "Tout gratuit" }] } }) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.data.token, /^[A-Za-z0-9]{32}$/);
  token = r.data.token;
  const res = r.data.result;
  assert.equal(res.version, REF.version);
  assert.equal(res.cases.length, 2);
  const dce = res.cases.find((c) => c.code === "SKILL_TRV_LIRE_DCE");
  assert.equal(dce.quadrant, "tester");
  const normes = res.cases.find((c) => c.code === "SKILL_BET_VEILLE_NORMATIVE");
  assert.equal(normes.effort, 4, "effort relevé : corpus nécessaire et données de niveau 2");
  assert.equal(normes.ajuste, true);
  assert.equal(normes.quadrant, "cadrer");
  assert.deepEqual(res.acquis.map((a) => a.code), ["SKILL_TRV_TRI_MAILS"]);
  assert.deepEqual(res.offres.map((o) => o.code), ["atelier"], "cadre 1 : pas d'accompagnement proposé");
  assert.deepEqual(res.ressources.map((o) => o.code), ["mooc", "data"]);
  assert.ok(!JSON.stringify(res).includes("Tout gratuit"));
});

test("une session ouverte impose sa version et accepte la version courte", async () => {
  await api("PATCH", `${records("sessions")}/${session.id}`, { token: staff, body: { flow: "court" } });
  const short = { firstname: "Léa", company: "EXB", email: `lea.${RUN}@exemple.fr`, maillon: "bureau_etudes", levels: { ia: 3, donnees: 3, cadre: 3 },
    cases: [{ code: "SKILL_BET_COHERENCE_NOTE_CALCUL", state: "veut", priority: 5 }], consent_processing: true, session: code };
  const ok = await api("POST", "/api/app/diagnostics", { body: short });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.deepEqual(ok.data.result.offres.map((o) => o.code), ["accompagnement"]);
  const out = await api("POST", "/api/app/diagnostics", { body: { ...short, cases: [{ code: "SKILL_MEN_ANALYSE_DEMANDE", state: "veut", priority: 4 }] } });
  assert.equal(out.status, 400, "cas absent de la version courte");
});

test("le consentement de partage n'est retenu que si la session le prévoit", async () => {
  const withLabel = await api("POST", "/api/app/diagnostics", { body: diag({ session: code, cases: [{ code: "SKILL_TRV_LIRE_DCE", state: "veut", priority: 4 }] }) });
  assert.equal(withLabel.status, 201);
  const free = await api("POST", "/api/app/diagnostics", { body: diag() });
  assert.equal(free.status, 201);
  const l = await api("GET", `${records("diagnostics")}?perPage=200&filter=${encodeURIComponent(`source = "test"`)}&sort=-created`, { token: staff });
  const bySession = l.data.items.filter((d) => d.session === session.id);
  const noSession = l.data.items.filter((d) => !d.session);
  assert.ok(bySession.length >= 1 && bySession.every((d) => d.consent_partner === true));
  assert.ok(noSession.length >= 1 && noSession.every((d) => d.consent_partner === false));
});

/* ---------- Rapport et données nominatives ---------- */
test("le rapport se lit avec son jeton, sans e-mail ni téléphone", async () => {
  const r = await api("GET", `/api/app/report/${token}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.firstname, "Camille");
  assert.equal(r.data.maillon, "Bureau d'études bois, ingénierie");
  assert.equal(r.data.email, undefined);
  assert.equal(r.data.result.cases.length, 2);
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("le rapport donne l'adresse masquée et permet 3 renvois par e-mail au plus", async () => {
  const r = await api("GET", `/api/app/report/${token}`);
  assert.equal(r.data.email_masked, `c•••@exemple.fr`);
  assert.equal(r.data.can_resend, true);
  // Le diagnostic vient d'être déposé : l'envoi est déjà en file, un renvoi ne compte pas.
  let s = await api("POST", `/api/app/report/${token}/email`);
  assert.equal(s.status, 202);
  assert.match(s.data.message, /Envoi en cours/);
  const l = await api("GET", `${records("diagnostics")}?perPage=200&filter=${encodeURIComponent(`email = "camille.${RUN}@exemple.fr" && source = "test"`)}&sort=created`, { token: staff });
  const id = l.data.items[0].id;
  for (let i = 1; i <= 3; i++) {
    await api("PATCH", `${records("diagnostics")}/${id}`, { token: staff, body: { report_status: "envoye" } });
    s = await api("POST", `/api/app/report/${token}/email`);
    assert.equal(s.status, 202, `renvoi ${i}`);
    assert.match(s.data.message, /reparti/);
    const d = await api("GET", `${records("diagnostics")}/${id}`, { token: staff });
    assert.equal(d.data.report_status, "a_envoyer");
    assert.equal(d.data.report_requests, i);
  }
  await api("PATCH", `${records("diagnostics")}/${id}`, { token: staff, body: { report_status: "envoye" } });
  s = await api("POST", `/api/app/report/${token}/email`);
  assert.equal(s.status, 429);
  assert.equal((await api("GET", `/api/app/report/${token}`)).data.can_resend, false);
  assert.equal((await api("POST", `/api/app/report/${"b".repeat(32)}/email`)).status, 404);
});

test("un jeton inconnu ou mal formé ne révèle rien", async () => {
  assert.equal((await api("GET", `/api/app/report/${"a".repeat(32)}`)).status, 404);
  assert.equal((await api("GET", "/api/app/report/abc")).status, 404);
  assert.equal((await api("GET", `/api/app/report/${token.slice(0, 31)}%22`)).status, 404);
});

test("un anonyme ne liste ni ne lit les diagnostics", async () => {
  const l = await api("GET", records("diagnostics"));
  assert.equal(l.status, 200);
  assert.equal(l.data.items.length, 0);
  assert.equal((await api("POST", records("diagnostics"), { body: diag() })).status, 403, "création réservée à la route de dépôt");
});

test("l'équipe lit les diagnostics sans voir le jeton du rapport", async () => {
  const l = await api("GET", `${records("diagnostics")}?perPage=1&sort=-created`, { token: staff });
  assert.equal(l.status, 200);
  assert.ok(l.data.items.length === 1);
  assert.equal(l.data.items[0].token, undefined);
});

test("l'équipe met à jour le suivi, jamais les réponses ni le résultat", async () => {
  const l = await api("GET", `${records("diagnostics")}?perPage=1&sort=-created`, { token: staff });
  const id = l.data.items[0].id;
  const ok = await api("PATCH", `${records("diagnostics")}/${id}`, { token: staff, body: { lead_status: "contacte", notes: "Rappel prévu" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.lead_status, "contacte");
  const ko = await api("PATCH", `${records("diagnostics")}/${id}`, { token: staff, body: { levels: { ia: 5, donnees: 5, cadre: 5 } } });
  assert.notEqual(ko.status, 200);
  const after = await api("GET", `${records("diagnostics")}/${id}`, { token: staff });
  assert.notDeepEqual(after.data.levels, { ia: 5, donnees: 5, cadre: 5 });
});

/* ---------- Vue salle ---------- */
test("la vue salle exige la clé animateur", async () => {
  assert.equal((await api("GET", `/api/app/sessions/${code}/live`)).status, 404);
  assert.equal((await api("GET", `/api/app/sessions/${code}/live`, { headers: { "X-Presenter-Key": "mauvaise-cle" } })).status, 404);
});

test("la vue salle n'agrège qu'à partir de 3 réponses, sans aucun nom", async () => {
  const key = { "X-Presenter-Key": sessionKey };
  let r = await api("GET", `/api/app/sessions/${code}/live`, { headers: key });
  assert.equal(r.status, 200);
  assert.equal(r.data.stats.ready, false);
  assert.equal(r.data.stats.n, 2);
  assert.equal(r.data.stats.axes, undefined);
  const third = await api("POST", "/api/app/diagnostics", { body: { firstname: "Noé", company: "Arbo", email: `noe.${RUN}@exemple.fr`, maillon: "bureau_etudes",
    levels: { ia: 1, donnees: 2, cadre: 2 }, pulse: 2, cases: [{ code: "SKILL_TRV_LIRE_DCE", state: "veut", priority: 5 }], consent_processing: true, session: code } });
  assert.equal(third.status, 201);
  r = await api("GET", `/api/app/sessions/${code}/live`, { headers: key });
  assert.equal(r.data.stats.ready, true);
  assert.equal(r.data.stats.n, 3);
  assert.deepEqual(r.data.stats.axes.ia.dist, [1, 1, 1, 0, 0]);
  assert.equal(r.data.stats.top[0].code, "SKILL_TRV_LIRE_DCE");
  assert.equal(r.data.stats.top[0].count, 2);
  assert.equal(r.data.session.baseline.usage_ia, 2.1);
  const raw = JSON.stringify(r.data);
  for (const name of ["Léa", "Noé", "Camille", "@exemple.fr"]) assert.ok(!raw.includes(name), `pas de ${name} dans la vue salle`);
});

/* ---------- Routes de l'équipe ---------- */
test("les sessions de l'équipe donnent la clé animateur et le nombre de diagnostics", async () => {
  assert.equal((await api("GET", "/api/app/staff/sessions")).status, 401);
  const r = await api("GET", "/api/app/staff/sessions", { token: staff });
  assert.equal(r.status, 200);
  const s = r.data.items.find((x) => x.code === code);
  assert.equal(s.presenter_key, sessionKey);
  assert.equal(s.diagnostics, 3);
});

test("l'export CSV est réservé à l'équipe et neutralise les formules", async () => {
  assert.equal((await api("GET", `/api/app/export.csv?session=${code}`, { raw: true })).status, 401);
  const evil = await api("POST", "/api/app/diagnostics", { body: diag({ session: code, company: "=HYPERLINK(\"http://x\")", cases: [{ code: "SKILL_TRV_LIRE_DCE", state: "veut", priority: 3 }] }) });
  assert.equal(evil.status, 201);
  const r = await api("GET", `/api/app/export.csv?session=${code}`, { token: staff, raw: true });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/csv/);
  assert.match(r.headers.get("content-disposition"), /attachment; filename="perfia-diagnostics-/);
  // fetch().text() retire le BOM : on vérifie les octets bruts.
  const bytes = new Uint8Array(await (await fetch(`${BASE}/api/app/export.csv?session=${code}`, { headers: { Authorization: staff } })).arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "BOM UTF-8 pour Excel");
  assert.ok(r.data.replace(/^﻿/, "").startsWith("Date;Session;Prénom"));
  assert.equal(r.data.trim().split("\r\n").length, 5, "en-tête + 4 diagnostics de la session");
  assert.ok(r.data.includes(`"'=HYPERLINK(""http://x"")"`));
  assert.equal((await api("GET", "/api/app/export.csv?session=inconnue-zz", { token: staff, raw: true })).status, 404);
});

test("une session qui a des diagnostics ne se supprime pas", async () => {
  const r = await api("DELETE", `${records("sessions")}/${session.id}`, { token: staff });
  assert.equal(r.status, 400);
});

test("une session fermée refuse les nouvelles réponses", async () => {
  await api("PATCH", `${records("sessions")}/${session.id}`, { token: staff, body: { status: "fermee" } });
  const r = await api("POST", "/api/app/diagnostics", { body: diag({ session: code }) });
  assert.equal(r.status, 400);
  assert.match(r.data.message, /fermée/);
  const pub = await api("GET", `/api/app/sessions/${code}`);
  assert.equal(pub.data.status, "fermee");
});

/* ---------- MCP ---------- */
test("le serveur MCP refuse sans clé et sert l'équipe avec une clé personnelle", async () => {
  assert.equal((await mcp(null, "initialize", {})).status, 401);
  const k = await api("POST", "/api/app/keys", { token: staff, body: { name: "Claude" } });
  assert.equal(k.status, 200);
  const key = k.data.key;
  const init = await mcp(key, "initialize", { protocolVersion: "2025-06-18" });
  assert.equal(init.status, 200);
  assert.match(init.data.result.instructions, /filière forêt-bois/);
  const list = await mcp(key, "tools/list", {});
  assert.deepEqual(list.data.result.tools.map((t) => t.name), ["list_sessions", "session_stats", "list_diagnostics", "get_diagnostic", "set_lead_status"]);
  const stats = await mcp(key, "tools/call", { name: "session_stats", arguments: { code } });
  assert.ok(!stats.data.result.isError, JSON.stringify(stats.data));
  assert.match(stats.data.result.content[0].text, /4 diagnostic\(s\)/);
  const diags = await mcp(key, "tools/call", { name: "list_diagnostics", arguments: { session: code, consent_contact: true } });
  assert.match(diags.data.result.content[0].text, /Camille Durand/);
  const id = diags.data.result.content[0].text.match(/id: ([a-z0-9]{15})/)[1];
  const one = await mcp(key, "tools/call", { name: "get_diagnostic", arguments: { id } });
  assert.match(one.data.result.content[0].text, /Axes :/);
  const set = await mcp(key, "tools/call", { name: "set_lead_status", arguments: { id, lead_status: "qualifie" } });
  assert.match(set.data.result.content[0].text, /Qualifié/);
});

test("les découvertes MCP et OAuth sont publiques", async () => {
  const llms = await api("GET", "/llms.txt", { raw: true });
  assert.equal(llms.status, 200);
  assert.match(llms.data, /PerfIA/);
  const meta = await api("GET", "/.well-known/oauth-authorization-server");
  assert.equal(meta.status, 200);
  assert.deepEqual(meta.data.scopes_supported, ["diagnostics"]);
});

/* ---------- E-mail de la feuille de route ---------- */
test("l'e-mail contient le lien du rapport, les offres, le rendez-vous de 30 minutes et les ressources", async () => {
  // domain.js n'utilise aucun global PocketBase : on l'appelle directement avec le résultat réel d'un dépôt.
  const domain = requireCjs("../pocketbase/pb_hooks/domain.js");
  const out = await api("POST", "/api/app/diagnostics", { body: diag({ email: `mail.${RUN}@exemple.fr` }) });
  const mail = domain.reportEmail("PerfIA Diagnostic IA", "https://diag.exemple.fr", { firstname: "Camille", token: out.data.token, result: out.data.result }, REF);
  for (const part of [mail.html, mail.text]) {
    assert.ok(part.includes(`https://diag.exemple.fr/rapport.html#${out.data.token}`), "lien du rapport");
    assert.ok(part.includes(REF.app.rdv_url), "rendez-vous de 30 minutes");
    for (const r of out.data.result.ressources) assert.ok(part.includes(r.url), `ressource ${r.code}`);
  }
  assert.match(mail.html, /Pour aller plus loin/);
  assert.match(mail.html, /Réserver 30 minutes/);
  for (const o of out.data.result.offres) assert.ok(mail.text.includes(o.titre), `offre ${o.code}`);
  assert.ok(!mail.html.includes("<script"), "pas de script dans l'e-mail");
});

/* ---------- Relance après la session ---------- */
test("la migration ajoute les champs de la relance", async () => {
  const s = await api("GET", "/api/collections/sessions", { token: admin });
  const d = await api("GET", "/api/collections/diagnostics", { token: admin });
  for (const n of ["followup", "followup_at", "followup_message", "followup_done_at", "followup_sent"]) assert.ok(s.data.fields.some((f) => f.name === n), n);
  for (const n of ["followup_sent_at", "followup_attempts"]) assert.ok(d.data.fields.some((f) => f.name === n), n);
});

test("une nouvelle session est relancée le lendemain par défaut ; « aucune » coupe la relance", async () => {
  const mk = (suffix, extra) => api("POST", records("sessions"), { token: staff, body: { code: `fu-${suffix}-${RUN}`, title: "Webinaire Xylofutur", date: "2026-11-26 09:00:00.000Z", ...extra } });
  const auto = await mk("a", {});
  assert.equal(auto.status, 200, JSON.stringify(auto.data));
  assert.equal(auto.data.followup, "auto");
  const off = await mk("b", { followup: "aucune" });
  assert.equal(off.data.followup, "aucune");
  const fixed = await mk("c", { followup_at: "2026-11-28 14:30:00.000Z" });
  const list = (await api("GET", "/api/app/staff/sessions", { token: staff })).data.items;
  const byCode = (c) => list.find((s) => s.code === c);
  assert.equal(byCode(`fu-a-${RUN}`).followup_scheduled, "2026-11-27 09:00:00.000Z", "lendemain, même heure");
  assert.equal(byCode(`fu-b-${RUN}`).followup_scheduled, "");
  assert.equal(byCode(`fu-c-${RUN}`).followup_scheduled, "2026-11-28 14:30:00.000Z", "date choisie");
  assert.equal(byCode(`fu-a-${RUN}`).followup_sent, 0);
  assert.equal(fixed.data.followup, "auto");
});

test("l'aperçu de la relance est réservé à l'équipe et ne vise que les participants d'accord pour être recontactés", async () => {
  const path = `/api/app/staff/sessions/${code}/followup`;
  assert.equal((await api("GET", path)).status, 401);
  assert.equal((await api("GET", `/api/app/staff/sessions/inconnue-${RUN}/followup`, { token: staff })).status, 404);
  const r = await api("GET", path, { token: staff });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const all = (await api("GET", `${records("diagnostics")}?perPage=500&filter=${encodeURIComponent(`session = "${session.id}"`)}`, { token: staff })).data.items;
  const ok = all.filter((d) => d.consent_contact && d.email);
  assert.ok(ok.length < all.length, "la session compte au moins un participant sans accord de recontact");
  assert.equal(r.data.recipients, ok.length);
  assert.equal(r.data.responses, all.length);
  assert.equal(r.data.subject, "Restitution des ateliers IBC : merci, et maintenant ?");
  assert.match(r.data.html, /Et pour la suite/);
  assert.ok(!r.data.html.includes("<script"));
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("la relance donne les résultats de la salle à partir de 3 réponses, et rien en dessous", async () => {
  const domain = requireCjs("../pocketbase/pb_hooks/domain.js");
  const scoring = requireCjs("../pocketbase/pb_hooks/scoring.js");
  const row = (cases, ia) => ({ maillon: "bureau_etudes", levels: { ia, donnees: 2, cadre: 1 }, pulse: 3, cases: cases.map((c) => ({ code: c, state: "veut", priority: 5 })) });
  const rows = [row(["SKILL_TRV_LIRE_DCE", "SKILL_TRV_TRI_MAILS"], 1), row(["SKILL_TRV_LIRE_DCE"], 2), row(["SKILL_TRV_LIRE_DCE", "SKILL_TRV_TABLEAU_BORD"], 4)];
  const st = scoring.aggregate(REF, rows, { top: 5 });
  assert.equal(st.choix.total, 5);
  assert.equal(st.choix.moyenne, 1.7);
  assert.equal(st.choix.par_type.reduce((a, t) => a + t.count, 0), 5);
  assert.ok(st.choix.familles.every((f) => f.code !== "tous"), "la famille « tous » n'est pas un métier");
  assert.equal(st.choix.familles[0].label, REF.familles.ao.label, "la consultation domine : 3 choix");
  assert.deepEqual(domain.percents([1, 1, 1]), [34, 33, 33]);

  const out = await api("POST", "/api/app/diagnostics", { body: diag({ email: `relance.${RUN}@exemple.fr` }) });
  const me = { firstname: "Camille", token: out.data.token, levels: { ia: 2, donnees: 2, cadre: 1 }, result: out.data.result };
  const s = { title: "Restitution IBC", date: "2026-10-16 08:00:00.000Z", flow: "court", baseline: { label: "Atelier IBC 25/09", usage_ia: 2.1 },
    followup_message: "Merci d'avoir joué le jeu en visio.\n\nCe qui ressort : les consultations." };
  const mail = domain.followupEmail("PerfIA Diagnostic IA", "https://diag.exemple.fr", s, me, st, REF);
  assert.equal(mail.subject, "Restitution IBC : merci, et maintenant ?");
  assert.equal(mail.replyTo, REF.app.contact, "les réponses arrivent à l'équipe");
  const unescape = (h) => h.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  for (const part of [unescape(mail.html), mail.text]) {
    assert.ok(part.includes(`https://diag.exemple.fr/rapport.html#${out.data.token}`), "lien du rapport");
    assert.ok(part.includes(REF.app.rdv_url), "rendez-vous de 30 minutes");
    assert.ok(part.includes("le 16 octobre"));
    assert.ok(part.includes("3 participants ont fait le diagnostic"));
    assert.ok(part.includes(`${REF.cases.SKILL_TRV_LIRE_DCE.label} : 3 participants`), "cas le plus choisi");
    assert.ok(part.includes("Mesure de référence (Atelier IBC 25/09) : usage de l'IA à 2,1 sur 5"));
    assert.ok(part.includes("Vos niveaux : IA 2 ; Données 2 ; Cadre 1"));
    assert.ok(part.includes("Ce qui ressort : les consultations."), "mot d'ouverture de l'animateur");
    assert.ok(part.includes(REF.app.signature.nom));
    assert.ok(part.includes("version courte"), "invitation à la version complète");
    assert.ok(!part.includes("—"), "pas de tiret cadratin");
  }
  assert.match(mail.html, /La session en quelques chiffres/);

  const few = domain.followupEmail("PerfIA Diagnostic IA", "https://diag.exemple.fr", { ...s, followup_message: "" }, me, scoring.aggregate(REF, rows.slice(0, 2)), REF);
  assert.ok(!few.html.includes("quelques chiffres") && !few.text.includes("participants ont"), "rien sous 3 réponses");
  assert.ok(few.html.includes("Revoir ma feuille de route") && few.html.includes("Et pour la suite"));
  const esc = domain.followupEmail("A", "https://x", { title: "<b>Atelier</b>", followup_message: "<img src=x>" }, { firstname: "<i>", token: "t", result: {} }, null, REF);
  assert.ok(!esc.html.includes("<img src=x>") && !esc.html.includes("<b>Atelier</b>"), "textes échappés");
});

/* ---------- Bords ---------- */
test("le référentiel servi est celui de l'interface", async () => {
  const r = await api("GET", "/api/app/referentiel");
  assert.equal(r.data.version, REF.version);
  const js = await api("GET", "/js/scoring.js", { raw: true });
  assert.equal(js.status, 200);
  assert.equal(js.data, readFileSync(new URL("../pocketbase/pb_hooks/scoring.js", import.meta.url), "utf8"));
});

test("les en-têtes de sécurité sont posés", async () => {
  const r = await api("GET", "/api/health");
  assert.equal(r.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(r.headers.get("permissions-policy"), /camera=\(\)/);
});

test("la limitation de débit est active, avec une marge pour une salle derrière une seule adresse", async () => {
  const s = await api("GET", "/api/settings", { token: admin });
  assert.equal(s.data.rateLimits.enabled, true);
  const rule = s.data.rateLimits.rules.find((x) => x.label === "POST /api/app/diagnostics");
  assert.ok(rule && rule.maxRequests >= 60);
});
