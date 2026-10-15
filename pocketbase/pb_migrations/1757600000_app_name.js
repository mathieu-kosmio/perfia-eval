/// <reference path="../pb_data/types.d.ts" />
/**
 * PerfIA Diagnostic IA : nom de l'application sur une instance neuve.
 *
 * PocketBase s'appelle « Acme » par défaut ; ce nom apparaît dans les e-mails, la page d'autorisation OAuth et
 * llms.txt. On le remplace, sans toucher à un nom déjà choisi dans la console (Settings > Application).
 */
migrate((app) => {
  const settings = app.settings();
  if (!settings.meta.appName || settings.meta.appName === "Acme") {
    settings.meta.appName = "PerfIA Diagnostic IA";
    app.save(settings);
  }
}, (app) => {
  // Retour arrière volontairement vide.
});
