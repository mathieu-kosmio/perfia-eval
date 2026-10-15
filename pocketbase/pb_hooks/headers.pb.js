/// <reference path="../pb_data/types.d.ts" />
/**
 * PerfIA Diagnostic IA : en-têtes HTTP sur toutes les réponses, quel que soit le mode de déploiement
 * (Coolify, Traefik, binaire seul). PocketBase envoie déjà X-Content-Type-Options et X-Frame-Options.
 *
 * - Strict-Transport-Security : seulement quand la requête est arrivée en HTTPS (directement ou via le proxy).
 * - Referrer-Policy : l'adresse complète ne sort pas du site (le jeton du rapport vit dans le fragment, en plus).
 * - Permissions-Policy : ni micro, ni caméra, ni géolocalisation, ni paiement.
 * - Cache-Control « no-cache » sur les pages, scripts, styles et le référentiel : le navigateur revalide à chaque
 *   visite (une réponse 304 si rien n'a changé), donc un participant ne garde jamais une ancienne version après une
 *   mise à jour. Les images gardent le cache par défaut.
 */
routerUse((e) => {
  const h = e.response.header();
  const proto = String(e.request.header.get("X-Forwarded-Proto") || "").split(",")[0].trim().toLowerCase();
  if (e.isTLS() || proto === "https") h.set("Strict-Transport-Security", "max-age=31536000");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "microphone=(), camera=(), geolocation=(), payment=()");
  const path = String(e.request.url.path || "");
  if (!path.startsWith("/api/") && (path === "/" || /\.(html|js|css|json)$/.test(path))) h.set("Cache-Control", "no-cache");
  return e.next();
});
