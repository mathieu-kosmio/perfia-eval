# Pratiques MCP

Serveur MCP distant de PerfIA Diagnostic IA, réservé à l'équipe. Mode d'emploi : `docs/mcp.md`.

## Fonctionnement

- Streamable HTTP sans état, servi par PocketBase sur `POST /mcp` (`mcp.pb.js`, logique dans `mcp.js`).
  `GET /mcp` décrit le serveur ; un flux SSE reçoit 405.
- Authentification : clé personnelle `ak_` + 40 caractères (empreinte SHA-256 en base, 30 jours, révoquée au
  changement de mot de passe) ou OAuth 2.1 (code + PKCE, enregistrement dynamique) qui délivre le même type de clé.
- Chaque outil appelle l'API REST en boucle locale (`APP_INTERNAL_URL`) avec le jeton du membre : il a exactement
  les droits de la page Équipe.
- Lots JSON-RPC bornés à 20 messages.

## Outils

`list_sessions`, `session_stats`, `list_diagnostics`, `get_diagnostic`, `set_lead_status` ; prompt
`preparer_relances`. Les libellés métier (statuts) et les consignes d'initialisation viennent de `domain.js` ; le
contenu (cas, axes, quadrants) vient de `referentiel.js` ; les agrégats de `scoring.aggregate`.

## Règles

- Un outil n'envoie jamais de message : il prépare des brouillons, l'humain envoie.
- Un outil n'expose ni jeton de rapport ni clé animateur.
- Les consignes rappellent : ne recontacter que les prospects qui l'ont accepté, ne rien transmettre à un organisateur
  sans le consentement de partage, aucun gain chiffré non mesuré.
- Ajouter ou retirer un outil : mettre à jour `docs/mcp.md` et l'assertion de la liste exacte des outils dans
  `tests/api.test.mjs`.
