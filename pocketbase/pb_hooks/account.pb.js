/// <reference path="../pb_data/types.d.ts" />
/**
 * PerfIA Diagnostic IA : compte utilisateur.
 *
 * 1. GET /api/app/me -> { superadmin } : vrai si le membre connecté, adresse vérifiée, porte le même e-mail
 *    qu'un superutilisateur PocketBase (l'interface affiche alors le lien vers la console /_/).
 * 2. Mot de passe unique, dans un seul sens : quand un superutilisateur se connecte à la console ou change
 *    son mot de passe, le membre jumeau (même e-mail, adresse vérifiée) reçoit le même mot de passe.
 *    L'inverse est volontairement impossible (voir account.js) : un compte membre, qui s'obtient par
 *    simple inscription, ne doit jamais pouvoir modifier un accès administrateur.
 *
 * 3. Clé de jeton changée (nouveau mot de passe, réinitialisation) : les clés MCP du membre sont révoquées.
 * 4. Chaque nuit, les comptes jamais confirmés depuis 7 jours sont supprimés.
 *
 * Les inscriptions exigent une adresse vérifiée pour se connecter (authRule de users dans pb_schema.json).
 */

routerAdd("GET", "/api/app/me", (e) => {
  const acc = require(`${__hooks}/account.js`);
  return e.json(200, { superadmin: acc.isSuperadmin($app, e.auth) });
}, $apis.requireAuth());

// Connexion réussie à la console : on aligne le membre jumeau sur le mot de passe qui vient d'être validé
onRecordAuthWithPasswordRequest((e) => {
  e.next();
  require(`${__hooks}/account.js`).syncMemberFromSuperuser($app, e.record.get("email"), e.password);
}, "_superusers");

// Changement de mot de passe d'un superutilisateur : on propage au membre jumeau
onRecordUpdateRequest((e) => {
  const pwd = String(e.requestInfo().body.password || "");
  e.next();
  if (pwd) require(`${__hooks}/account.js`).syncMemberFromSuperuser($app, e.record.get("email"), pwd);
}, "_superusers");

// Nouveau mot de passe ou reprise du compte : PocketBase renouvelle tokenKey, on révoque aussi les clés MCP.
onRecordUpdate((e) => {
  // PocketBase renouvelle tokenKey pendant l'enregistrement : on compare à l'état chargé, après e.next().
  const before = String(e.record.original().get("tokenKey"));
  e.next();
  if (String(e.record.get("tokenKey")) !== before) require(`${__hooks}/account.js`).revokeKeys(e.app, e.record.id);
}, "users");

cronAdd("perfia_purge_unverified", "17 3 * * *", () => {
  const acc = require(`${__hooks}/account.js`);
  acc.purgeUnverified($app, acc.UNVERIFIED_DAYS);
});
