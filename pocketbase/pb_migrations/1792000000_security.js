/// <reference path="../pb_data/types.d.ts" />
/**
 * PerfIA Diagnostic IA : limitation de débit par adresse IP et proxy de confiance.
 *
 * Le dépôt d'un diagnostic est public : une salle entière peut partager la même adresse IP (Wi-Fi du lieu,
 * 4G d'un même relais). La limite de dépôt est donc large (60 par 10 minutes) ; le champ piège et la validation
 * côté serveur font le reste. Derrière Coolify ou Traefik, l'adresse réelle est lue dans X-Forwarded-For.
 *
 * Les limites sont un réglage de l'instance, pas du schéma : elles se changent par une nouvelle migration
 * ou dans la console (Settings > Application).
 */
migrate((app) => {
  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [
    { label: "_superusers:auth", audience: "", duration: 60, maxRequests: 10 },
    { label: "*:auth", audience: "", duration: 60, maxRequests: 30 },
    { label: "/api/collections/users/request-", audience: "", duration: 600, maxRequests: 10 },
    { label: "POST /api/app/diagnostics", audience: "", duration: 600, maxRequests: 60 },
    { label: "/api/app/sessions/", audience: "", duration: 60, maxRequests: 240 },
    { label: "/api/app/report/", audience: "", duration: 60, maxRequests: 60 },
    { label: "/mcp", audience: "", duration: 60, maxRequests: 120 },
    { label: "/oauth/", audience: "", duration: 60, maxRequests: 20 },
    { label: "/api/batch", audience: "", duration: 1, maxRequests: 3 },
    { label: "/api/", audience: "", duration: 10, maxRequests: 300 },
  ];
  if (!settings.trustedProxy.headers || !settings.trustedProxy.headers.length) settings.trustedProxy.headers = ["X-Forwarded-For"];
  app.save(settings);
}, (app) => {
  // Retour arrière volontairement vide : rouvrir ces accès sans limite n'a pas de sens.
});
