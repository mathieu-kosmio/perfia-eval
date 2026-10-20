/// <reference path="../pb_data/types.d.ts" />
/**
 * PerfIA Diagnostic IA : routes et tâches du diagnostic (logique dans diag.js).
 *
 * Public, sans compte :
 *   GET  /s/{code}                          lien court d'une session : redirige vers /?s={code}
 *   GET  /api/app/referentiel               version du référentiel servi (contrôle de cohérence)
 *   GET  /api/app/sessions/{code}           champs publics d'une session ouverte ou fermée
 *   POST /api/app/diagnostics               dépôt d'un diagnostic ; renvoie le jeton du rapport et le résultat
 *   GET  /api/app/report/{token}            rapport d'un diagnostic (jeton de 32 caractères, valable 12 mois)
 *   POST /api/app/report/{token}/email      renvoi de la feuille de route par e-mail (3 fois au plus)
 * Animateur (clé de session dans l'en-tête X-Presenter-Key) :
 *   GET  /api/app/sessions/{code}/live      agrégats anonymes, rien sous 3 réponses
 * Équipe (compte users) :
 *   GET  /api/app/staff/sessions            sessions avec clé animateur, nombre de diagnostics et état de la relance
 *   GET  /api/app/staff/sessions/{code}/followup   aperçu de la relance (date, destinataires, message)
 *   GET  /api/app/export.csv?session=code   export CSV (toutes les sessions sans paramètre)
 *
 * Tâches : envoi des rapports par e-mail (chaque minute), relance des participants après une session (toutes les
 * 5 minutes), inscription à la liste Brevo des invitations (toutes les 10 minutes), conservation des données
 * (chaque nuit).
 * Note PocketBase : chaque handler s'exécute dans une VM isolée, d'où les require() à l'intérieur.
 */

routerAdd("GET", "/s/{code}", (e) => {
  const code = String(e.request.pathValue("code") || "").toLowerCase();
  if (!require(`${__hooks}/diag.js`).CODE_RE.test(code)) return e.redirect(302, "/");
  return e.redirect(302, `/?s=${encodeURIComponent(code)}`);
});

routerAdd("GET", "/api/app/referentiel", (e) => {
  const ref = require(`${__hooks}/referentiel.js`);
  return e.json(200, { version: ref.version });
});

routerAdd("GET", "/api/app/sessions/{code}", (e) => {
  const diag = require(`${__hooks}/diag.js`);
  const s = diag.findSession($app, e.request.pathValue("code"));
  if (!s || s.getString("status") === "brouillon") return e.json(404, { message: "Cette session n'existe pas." });
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, diag.publicSession(s));
});

routerAdd("POST", "/api/app/diagnostics", (e) => {
  let body = {};
  try { body = e.requestInfo().body || {}; } catch (_) {}
  const out = require(`${__hooks}/diag.js`).createDiagnostic($app, body);
  return e.json(out.status, out.body);
});

routerAdd("GET", "/api/app/report/{token}", (e) => {
  const r = require(`${__hooks}/diag.js`).reportFor($app, e.request.pathValue("token"));
  e.response.header().set("Cache-Control", "no-store");
  e.response.header().set("X-Robots-Tag", "noindex");
  if (!r) return e.json(404, { message: "Ce rapport n'existe pas ou n'est plus disponible." });
  return e.json(200, r);
});

routerAdd("POST", "/api/app/report/{token}/email", (e) => {
  const out = require(`${__hooks}/diag.js`).requestReport($app, e.request.pathValue("token"));
  e.response.header().set("Cache-Control", "no-store");
  return e.json(out.status, out.body);
});

routerAdd("GET", "/api/app/sessions/{code}/live", (e) => {
  const key = String(e.request.header.get("X-Presenter-Key") || "");
  const r = require(`${__hooks}/diag.js`).liveFor($app, e.request.pathValue("code"), key);
  e.response.header().set("Cache-Control", "no-store");
  if (!r) return e.json(404, { message: "Session ou clé animateur inconnue." });
  return e.json(200, r);
});

routerAdd("GET", "/api/app/staff/sessions", (e) => {
  return e.json(200, { items: require(`${__hooks}/diag.js`).staffSessions($app) });
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/app/staff/sessions/{code}/followup", (e) => {
  const r = require(`${__hooks}/diag.js`).followupPreview($app, e.request.pathValue("code"));
  e.response.header().set("Cache-Control", "no-store");
  if (!r) return e.json(404, { message: "Session inconnue." });
  return e.json(200, r);
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/app/export.csv", (e) => {
  const code = String(e.request.url.query().get("session") || "");
  const csv = require(`${__hooks}/diag.js`).exportCsv($app, code);
  if (csv === null) return e.json(404, { message: "Session inconnue." });
  const name = `perfia-diagnostics-${code || "toutes"}-${new Date().toISOString().slice(0, 10)}.csv`;
  e.response.header().set("Content-Disposition", `attachment; filename="${name}"`);
  e.response.header().set("Cache-Control", "no-store");
  return e.blob(200, "text/csv; charset=utf-8", csv);
}, $apis.requireAuth("users"));

// Sessions : code en minuscules, valeurs par défaut, clé animateur générée à la création.
onRecordCreateRequest((e) => {
  require(`${__hooks}/diag.js`).prepareSession(e.record, true);
  e.next();
}, "sessions");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/diag.js`).prepareSession(e.record, false);
  e.next();
}, "sessions");

// Une session référencée par des diagnostics ne se supprime pas : on la ferme.
onRecordDeleteRequest((e) => {
  const n = $app.countRecords("diagnostics", $dbx.hashExp({ session: e.record.id }));
  if (n > 0) throw new BadRequestError(`Cette session compte ${n} diagnostic(s) : fermez-la plutôt que de la supprimer.`);
  e.next();
}, "sessions");

cronAdd("perfia_reports", "* * * * *", () => {
  require(`${__hooks}/diag.js`).sendPendingReports($app);
});

cronAdd("perfia_relances", "*/5 * * * *", () => {
  require(`${__hooks}/diag.js`).sendFollowups($app);
});

cronAdd("perfia_brevo", "*/10 * * * *", () => {
  require(`${__hooks}/diag.js`).syncBrevoContacts($app);
});

cronAdd("perfia_retention", "23 3 * * *", () => {
  require(`${__hooks}/diag.js`).purge($app);
});
