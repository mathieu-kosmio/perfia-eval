/// <reference path="../pb_data/types.d.ts" />
/**
 * PerfIA Diagnostic IA : relance envoyée aux participants après une session.
 *
 * Sessions :
 * - followup : « auto » (relance automatique) ou « aucune ». Les sessions existantes restent sans valeur, donc sans
 *   relance : aucun envoi ne part tout seul pour une session passée au moment du déploiement.
 * - followup_at : date d'envoi choisie ; vide, le lendemain de la session (même heure).
 * - followup_message : paragraphe d'ouverture écrit par l'animateur (facultatif).
 * - followup_done_at, followup_sent : fin de l'envoi et nombre de messages partis.
 * Diagnostics :
 * - followup_sent_at, followup_attempts : envoi de la relance à ce participant (3 essais au plus).
 *
 * pb_schema.json porte déjà ces champs pour les installations neuves ; la migration les ajoute aux bases existantes.
 */
migrate((app) => {
  const s = app.findCollectionByNameOrId("sessions");
  if (!s.fields.getByName("followup")) s.fields.add(new SelectField({ name: "followup", required: false, maxSelect: 1, values: ["auto", "aucune"] }));
  if (!s.fields.getByName("followup_at")) s.fields.add(new DateField({ name: "followup_at", required: false }));
  if (!s.fields.getByName("followup_message")) s.fields.add(new TextField({ name: "followup_message", required: false, max: 1500 }));
  if (!s.fields.getByName("followup_done_at")) s.fields.add(new DateField({ name: "followup_done_at", required: false }));
  if (!s.fields.getByName("followup_sent")) s.fields.add(new NumberField({ name: "followup_sent", required: false, min: 0, onlyInt: true }));
  app.save(s);

  const d = app.findCollectionByNameOrId("diagnostics");
  if (!d.fields.getByName("followup_sent_at")) d.fields.add(new DateField({ name: "followup_sent_at", required: false }));
  if (!d.fields.getByName("followup_attempts")) d.fields.add(new NumberField({ name: "followup_attempts", required: false, min: 0, onlyInt: true }));
  app.save(d);
}, (app) => {
  const s = app.findCollectionByNameOrId("sessions");
  ["followup", "followup_at", "followup_message", "followup_done_at", "followup_sent"].forEach((n) => s.fields.removeByName(n));
  app.save(s);
  const d = app.findCollectionByNameOrId("diagnostics");
  ["followup_sent_at", "followup_attempts"].forEach((n) => d.fields.removeByName(n));
  app.save(d);
});
