/**
 * PerfIA Diagnostic IA : logique serveur des sessions et des diagnostics (module CommonJS, chargé par diag.pb.js
 * et mcp.js). Les hooks contournent les règles d'accès : chaque fonction publique ne renvoie que des champs prévus
 * pour le public (session ouverte, rapport par jeton, agrégats anonymes au-delà du seuil).
 */

const D = () => require(`${__hooks}/domain.js`);
const S = () => require(`${__hooks}/scoring.js`);
const REF = () => require(`${__hooks}/referentiel.js`);

const TOKEN_RE = /^[A-Za-z0-9]{32}$/;
const CODE_RE = /^[a-z0-9][a-z0-9-]{1,23}$/;

/* ---------- Utilitaires ---------- */
function json(rec, field) {
  try { const s = rec.getString(field); return s ? JSON.parse(s) : null; } catch (_) { return null; }
}
const iso = (d) => d.toISOString().replace("T", " ");
const monthsAgo = (m) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d; };
const parseDate = (v) => { const t = Date.parse(String(v || "").replace(" ", "T")); return isNaN(t) ? 0 : t; };

function findSession(app, code) {
  code = String(code || "").trim().toLowerCase();
  if (!CODE_RE.test(code)) return null;
  try { return app.findFirstRecordByData("sessions", "code", code); } catch (_) { return null; }
}

function logoUrl(rec) {
  const f = rec.getString("organizer_logo");
  return f ? `/api/files/${rec.collection().id}/${rec.id}/${encodeURIComponent(f)}` : "";
}

/** Champs publics d'une session (jamais la clé animateur ni les notes). */
function publicSession(rec) {
  return {
    code: rec.getString("code"),
    title: rec.getString("title"),
    date: rec.getString("date"),
    organizer_name: rec.getString("organizer_name"),
    organizer_logo: logoUrl(rec),
    default_maillon: rec.getString("default_maillon"),
    flow: rec.getString("flow") || "complet",
    identity_position: rec.getString("identity_position") || "debut",
    pulse_question: rec.getString("pulse_question"),
    partner_consent_label: rec.getString("partner_consent_label"),
    status: rec.getString("status"),
  };
}

/** Diagnostic décodé (champs JSON parsés), pour l'export, le MCP et les e-mails. */
function decode(rec, sessionCode) {
  return {
    id: rec.id, created: rec.getString("created"), session_code: sessionCode || "",
    firstname: rec.getString("firstname"), lastname: rec.getString("lastname"), company: rec.getString("company"),
    role: rec.getString("role"), email: rec.getString("email"), phone: rec.getString("phone"),
    maillon: rec.getString("maillon"), size: rec.getString("size"), flow: rec.getString("flow"),
    levels: json(rec, "levels") || {}, pulse: rec.getInt("pulse") || null, cases: json(rec, "cases") || [],
    free_text: rec.getString("free_text"), result: json(rec, "result") || {},
    consent_contact: rec.getBool("consent_contact"), consent_partner: rec.getBool("consent_partner"),
    consent_news: rec.getBool("consent_news"), lead_status: rec.getString("lead_status"),
    report_status: rec.getString("report_status"), duration_s: rec.getInt("duration_s"), token: rec.getString("token"),
  };
}

/* ---------- Sessions ---------- */

/** Valeurs par défaut et contrôles à l'enregistrement d'une session (console, page Équipe, API). */
function prepareSession(rec, isNew) {
  rec.set("code", String(rec.getString("code") || "").trim().toLowerCase());
  if (!rec.getString("flow")) rec.set("flow", "complet");
  if (!rec.getString("identity_position")) rec.set("identity_position", "debut");
  if (!rec.getString("status")) rec.set("status", "brouillon");
  const m = rec.getString("default_maillon");
  if (m && !REF().maillons.some((x) => x.code === m)) throw new BadRequestError(`Maillon inconnu : « ${m} ».`);
  const baseline = json(rec, "baseline");
  if (baseline !== null && (typeof baseline !== "object" || Array.isArray(baseline))) throw new BadRequestError("La mesure de référence doit être un objet JSON.");
  if (isNew && !rec.getString("presenter_key")) {
    const d = D();
    rec.set("presenter_key", $security.randomStringWithAlphabet(d.PRESENTER_KEY_LENGTH, d.PRESENTER_KEY_ALPHABET));
  }
}

/** Sessions vues par l'équipe : champs complets, clé animateur et nombre de diagnostics. */
function staffSessions(app) {
  const counts = {};
  const rows = arrayOf(new DynamicModel({ session: "", n: 0 }));
  app.db().newQuery("SELECT session, COUNT(*) AS n FROM diagnostics GROUP BY session").all(rows);
  rows.forEach((r) => { counts[r.session] = r.n; });
  return app.findRecordsByFilter("sessions", "id != ''", "-date,-created", 500, 0).map((rec) => Object.assign(publicSession(rec), {
    id: rec.id, presenter_key: rec.getString("presenter_key"), notes: rec.getString("notes"), baseline: json(rec, "baseline"),
    diagnostics: counts[rec.id] || 0, created: rec.getString("created"),
  }));
}

/* ---------- Dépôt d'un diagnostic ---------- */

/** Valide, recalcule et enregistre un diagnostic. Retourne { status, body }. */
function createDiagnostic(app, body) {
  const ref = REF(), d = D();
  body = body || {};
  if (body.website) return { status: 400, body: { message: "Requête refusée." } }; // champ piège pour les robots

  let session = null, flow = body.flow === "court" ? "court" : "complet", partner = false;
  if (body.session) {
    session = findSession(app, body.session);
    if (!session || session.getString("status") === "brouillon") return { status: 400, body: { message: "Cette session n'existe pas." } };
    if (session.getString("status") !== "ouverte") return { status: 400, body: { message: "Cette session est fermée : les réponses ne sont plus acceptées." } };
    flow = session.getString("flow") || "complet";
    partner = !!session.getString("partner_consent_label");
  }

  const v = S().validate(ref, body, { flow, partner });
  if (!v.ok) return { status: 400, body: { message: "Certaines réponses sont incomplètes.", data: v.errors } };
  const c = v.clean;
  const result = S().compute(ref, c);
  const token = $security.randomStringWithAlphabet(d.TOKEN_LENGTH, d.TOKEN_ALPHABET);

  const rec = new Record(app.findCollectionByNameOrId("diagnostics"));
  if (session) rec.set("session", session.id);
  rec.set("token", token);
  rec.set("referentiel_version", ref.version);
  rec.set("flow", flow);
  ["firstname", "lastname", "company", "role", "email", "phone", "maillon", "size", "free_text", "source"].forEach((k) => rec.set(k, c[k]));
  rec.set("levels", c.levels);
  rec.set("pulse", c.pulse || 0);
  rec.set("cases", c.cases);
  rec.set("result", result);
  rec.set("consent_processing", c.consent_processing);
  rec.set("consent_contact", c.consent_contact);
  rec.set("consent_partner", c.consent_partner);
  rec.set("consent_news", c.consent_news);
  rec.set("consent_text_version", d.CONSENT_TEXT_VERSION);
  rec.set("duration_s", c.duration_s);
  rec.set("lead_status", "nouveau");
  rec.set("report_status", c.email ? "a_envoyer" : "sans_envoi");
  rec.set("report_attempts", 0);
  rec.set("report_requests", 0);
  app.save(rec);
  return { status: 201, body: { token, report: `/rapport.html#${token}`, result } };
}

/* ---------- Rapport ---------- */

/** Rapport d'un diagnostic par son jeton, ou null (jeton inconnu, effacé ou expiré). */
function reportFor(app, token) {
  token = String(token || "");
  if (!TOKEN_RE.test(token)) return null;
  let rec;
  try { rec = app.findFirstRecordByData("diagnostics", "token", token); } catch (_) { return null; }
  if (parseDate(rec.getString("created")) < monthsAgo(D().REPORT_MONTHS).getTime()) return null;
  const ref = REF();
  let session = null;
  const sid = rec.getString("session");
  if (sid) { try { session = publicSession(app.findRecordById("sessions", sid)); } catch (_) {} }
  return {
    created: rec.getString("created"),
    firstname: rec.getString("firstname"), lastname: rec.getString("lastname"), company: rec.getString("company"),
    role: D().labelOf(ref.fonctions, rec.getString("role")), maillon: D().labelOf(ref.maillons, rec.getString("maillon")),
    referentiel_version: rec.getString("referentiel_version"),
    email_masked: D().maskEmail(rec.getString("email")),
    report_status: rec.getString("report_status"),
    can_resend: !!rec.getString("email") && rec.getInt("report_requests") < D().REPORT_MAX_REQUESTS,
    session: session ? { title: session.title, date: session.date, organizer_name: session.organizer_name, organizer_logo: session.organizer_logo } : null,
    result: json(rec, "result"),
  };
}

/**
 * Renvoi de la feuille de route par e-mail, à la demande du participant (jeton du rapport). La tâche planifiée
 * fait l'envoi ; 3 renvois au plus par diagnostic. Retourne { status, body }.
 */
function requestReport(app, token) {
  const d = D();
  token = String(token || "");
  if (!TOKEN_RE.test(token)) return { status: 404, body: { message: "Ce rapport n'existe pas." } };
  let rec;
  try { rec = app.findFirstRecordByData("diagnostics", "token", token); } catch (_) { return { status: 404, body: { message: "Ce rapport n'existe pas." } }; }
  if (!rec.getString("email") || rec.getBool("anonymized")) return { status: 404, body: { message: "Ce rapport n'existe pas." } };
  const masked = d.maskEmail(rec.getString("email"));
  if (rec.getString("report_status") === "a_envoyer") return { status: 202, body: { message: `Envoi en cours à ${masked}.`, email_masked: masked } };
  const n = rec.getInt("report_requests");
  if (n >= d.REPORT_MAX_REQUESTS) return { status: 429, body: { message: "La feuille de route a déjà été renvoyée plusieurs fois. Vérifiez vos courriers indésirables, ou écrivez-nous." } };
  rec.set("report_requests", n + 1);
  rec.set("report_status", "a_envoyer");
  rec.set("report_attempts", 0);
  app.saveNoValidate(rec);
  return { status: 202, body: { message: `C'est reparti : la feuille de route part à ${masked}.`, email_masked: masked } };
}

/* ---------- Vue salle ---------- */

/** Agrégats anonymes d'une session pour l'animateur, ou null si le code ou la clé ne conviennent pas. */
function liveFor(app, code, key) {
  const session = findSession(app, code);
  if (!session) return null;
  const expected = session.getString("presenter_key");
  if (!expected || $security.sha256(String(key || "")) !== $security.sha256(expected)) return null;
  const rows = app.findRecordsByFilter("diagnostics", "session = {:s}", "-created", 2000, 0, { s: session.id })
    .map((r) => ({ levels: json(r, "levels") || {}, pulse: r.getInt("pulse") || null, cases: json(r, "cases") || [] }));
  return {
    session: Object.assign(publicSession(session), { baseline: json(session, "baseline") }),
    pulse_question: session.getString("pulse_question") || REF().pulse_default,
    stats: S().aggregate(REF(), rows),
  };
}

/* ---------- Export ---------- */

function csvCell(v) {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // pas de formule exécutée à l'ouverture dans un tableur
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (séparateur « ; », BOM UTF-8 pour Excel) des diagnostics d'une session, ou de tous. */
function exportCsv(app, code) {
  const ref = REF(), cols = D().CSV_COLUMNS;
  let filter = "id != ''", params = {}, codes = {};
  if (code) {
    const s = findSession(app, code);
    if (!s) return null;
    filter = "session = {:s}"; params = { s: s.id }; codes[s.id] = s.getString("code");
  } else {
    app.findRecordsByFilter("sessions", "id != ''", "", 1000, 0).forEach((s) => { codes[s.id] = s.getString("code"); });
  }
  const recs = app.findRecordsByFilter("diagnostics", filter, "-created", 10000, 0, params);
  const lines = [cols.map((c) => csvCell(c[0])).join(";")];
  recs.forEach((r) => {
    const d = decode(r, codes[r.getString("session")]);
    lines.push(cols.map((c) => csvCell(c[1](d, ref))).join(";"));
  });
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* ---------- Tâches planifiées ---------- */

/** Envoie les rapports en attente (au plus 20 par passage, 3 essais par diagnostic). */
function sendPendingReports(app) {
  if (String($os.getenv("APP_SEND_REPORTS") || "") === "0") return 0;
  const d = D(), ref = REF();
  const meta = app.settings().meta;
  const base = String(meta.appURL || "").replace(/\/+$/, "");
  let sent = 0;
  const recs = app.findRecordsByFilter("diagnostics", "report_status = 'a_envoyer'", "created", 20, 0);
  recs.forEach((rec) => {
    const diag = decode(rec);
    const mail = d.reportEmail(meta.appName, base, diag, ref);
    try {
      app.newMailClient().send(new MailerMessage({
        from: { address: meta.senderAddress, name: meta.senderName || meta.appName },
        to: [{ address: diag.email, name: `${diag.firstname} ${diag.lastname}`.trim() }],
        subject: mail.subject, html: mail.html, text: mail.text,
      }));
      rec.set("report_status", "envoye");
      rec.set("report_sent_at", new Date().toISOString());
      sent++;
    } catch (err) {
      const n = rec.getInt("report_attempts") + 1;
      rec.set("report_attempts", n);
      if (n >= d.REPORT_MAX_ATTEMPTS) rec.set("report_status", "echec");
      app.logger().warn("perfia: envoi du rapport impossible", "id", rec.id, "essai", n, "err", String(err));
    }
    app.saveNoValidate(rec);
  });
  return sent;
}

/**
 * Inscrit à la liste Brevo des invitations les participants qui l'ont demandé (consentement 4), 20 par passage.
 * Actif seulement avec APP_BREVO_API_KEY et APP_BREVO_LIST_ID ; coupé par APP_SEND_REPORTS=0 (tests, instance locale).
 */
function syncBrevoContacts(app) {
  const key = String($os.getenv("APP_BREVO_API_KEY") || "").trim();
  const listId = Number($os.getenv("APP_BREVO_LIST_ID") || 0);
  if (!key || !listId || String($os.getenv("APP_SEND_REPORTS") || "") === "0") return 0;
  const pending = app.findRecordsByFilter("diagnostics", "consent_news = true && anonymized = false && email != '' && brevo_synced_at = ''", "created", 20, 0);
  if (!pending.length) return 0;
  const headers = { "api-key": key, "content-type": "application/json", accept: "application/json" };
  // Attributs de contact existant dans le compte Brevo (un appel par passage).
  const attrs = $http.send({ url: "https://api.brevo.com/v3/contacts/attributes", method: "GET", timeout: 15, headers });
  if (attrs.statusCode !== 200) { app.logger().warn("perfia: attributs Brevo illisibles", "statut", attrs.statusCode); return 0; }
  const existing = ((attrs.json || {}).attributes || []).filter((x) => x.category === "normal").map((x) => x.name);
  const codes = {};
  let done = 0;
  pending.forEach((rec) => {
      const sid = rec.getString("session");
      if (sid && codes[sid] === undefined) { try { codes[sid] = app.findRecordById("sessions", sid).getString("code"); } catch (_) { codes[sid] = ""; } }
      const res = $http.send({
        url: "https://api.brevo.com/v3/contacts", method: "POST", timeout: 15, headers,
        body: JSON.stringify(D().brevoContact(decode(rec, codes[sid] || ""), listId, existing)),
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        rec.set("brevo_synced_at", new Date().toISOString());
        app.saveNoValidate(rec);
        done++;
      } else {
        app.logger().warn("perfia: inscription Brevo impossible", "id", rec.id, "statut", res.statusCode, "réponse", String(res.raw || "").slice(0, 200));
      }
    });
  return done;
}

/** Conservation : identité effacée après 12 mois sans consentement de recontact, suppression après 36 mois. */
function purge(app) {
  const d = D();
  let anonymized = 0, deleted = 0;
  app.findRecordsByFilter("diagnostics", "anonymized = false && consent_contact = false && created < {:t}", "created", 1000, 0, { t: iso(monthsAgo(d.ANONYMIZE_MONTHS)) })
    .forEach((rec) => {
      ["firstname", "lastname", "company", "email", "phone", "free_text", "token", "notes"].forEach((k) => rec.set(k, ""));
      rec.set("anonymized", true);
      app.saveNoValidate(rec);
      anonymized++;
    });
  app.findRecordsByFilter("diagnostics", "updated < {:t}", "updated", 1000, 0, { t: iso(monthsAgo(d.DELETE_MONTHS)) })
    .forEach((rec) => { app.delete(rec); deleted++; });
  if (anonymized || deleted) app.logger().info("perfia: conservation appliquée", "anonymises", anonymized, "supprimes", deleted);
  return { anonymized, deleted };
}

module.exports = {
  TOKEN_RE, CODE_RE, json, findSession, publicSession, decode, prepareSession, staffSessions,
  createDiagnostic, reportFor, requestReport, liveFor, exportCsv, sendPendingReports, syncBrevoContacts, purge,
};
