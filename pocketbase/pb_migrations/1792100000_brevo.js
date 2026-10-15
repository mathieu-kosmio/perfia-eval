/// <reference path="../pb_data/types.d.ts" />
/**
 * PerfIA Diagnostic IA : champs du renvoi de la feuille de route et de la liste Brevo.
 *
 * - report_requests : nombre de renvois demandés depuis l'écran de fin ou le rapport (3 au plus).
 * - brevo_synced_at : date d'inscription du contact à la liste Brevo des invitations (consentement 4 seulement).
 *
 * pb_schema.json porte déjà ces champs pour les installations neuves ; la migration les ajoute aux bases existantes.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("diagnostics");
  if (!col.fields.getByName("report_requests")) col.fields.add(new NumberField({ name: "report_requests", required: false, min: 0, onlyInt: true }));
  if (!col.fields.getByName("brevo_synced_at")) col.fields.add(new DateField({ name: "brevo_synced_at", required: false }));
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("diagnostics");
  col.fields.removeByName("report_requests");
  col.fields.removeByName("brevo_synced_at");
  app.save(col);
});
