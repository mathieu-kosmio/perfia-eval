# CLAUDE.md

Consignes pour Claude Code dans ce dépôt.

## Le projet

**PerfIA Diagnostic IA** : diagnostic de maturité IA sur mobile pour la filière forêt-bois (Kosmio × Xylofutur).
Participants anonymes (aucun compte), sessions par intervention, vue salle, rapport imprimable, page Équipe, serveur
MCP pour l'équipe. Spécification : `docs/specification.md`. Socle : squelette Kosmio Skellyto (PocketBase), allégé.

Interface, documentation et commentaires en français ; identifiants en anglais. Pas de tiret cadratin dans les textes
de l'interface ni de la documentation.

## Structure

```
content/
  editorial.mjs                 couche éditoriale : maillons, axes et niveaux, catalogues, libellés, types, règles, offres
  processotheque.snapshot.json  instantané des cas d'usage de la Processothèque (textes longs, complexité, statut)
scripts/
  build-referentiel.mjs         construit le référentiel (make referentiel) ; --check pour les tests, --strict avant publication
  seed-demo.mjs                 compte d'équipe et session de démonstration (make demo)
  pb.sh, test.sh, import-schema.sh
pocketbase/
  pb_schema.json                collections et règles d'accès (source de vérité)
  pb_migrations/                import du schéma, nom de l'application, limitation de débit
  pb_hooks/
    scoring.js                  SOURCE UNIQUE des règles de calcul (recopiée dans web/js/scoring.js par make referentiel)
    referentiel.js              GÉNÉRÉ : ne pas modifier
    domain.js                   point unique métier côté serveur : statuts, durées de conservation, e-mail, export, consignes MCP
    diag.js, diag.pb.js         sessions, dépôt d'un diagnostic, rapport, vue salle, export, envoi des rapports, conservation
    mcp.js, mcp.pb.js           serveur MCP de l'équipe
    oauth.js, oauth.pb.js       OAuth 2.1 devant /mcp
    account.js, account.pb.js   alignement console vers compte d'équipe, révocation des clés MCP
    mail.pb.js, headers.pb.js   relais Brevo, en-têtes de sécurité
web/
  index.html + js/app.js        parcours participant
  rapport.html + js/rapport.js  rapport imprimable
  salle.html + js/salle.js      vue salle
  equipe.html + js/equipe.js    page Équipe
  donnees.html                  notice sur les données personnelles
  js/ui.js                      icônes, illustrations des niveaux, jauge, matrice, réseau, stockage local
  js/scoring.js                 GÉNÉRÉ (copie de pb_hooks/scoring.js)
  content/referentiel.json      GÉNÉRÉ
  css/perfia.css                jetons et composants (charte PerfIA co-brandée)
  vendor/qrcode.js              qrcode-generator 1.4.4 (MIT), intégré pour fonctionner hors ligne
tests/api.test.mjs              tests d'intégration
```

## Règles

- **Le contenu se modifie dans `content/`**, puis `make referentiel`. Ne jamais modifier à la main
  `web/content/referentiel.json`, `pocketbase/pb_hooks/referentiel.js` ni `web/js/scoring.js` : les tests échouent si
  ces fichiers ne correspondent pas aux sources.
- **Les règles de calcul vivent dans `pocketbase/pb_hooks/scoring.js`**, en JavaScript simple (pas de `?.`, pas de
  décomposition d'objet) : il tourne dans la VM des hooks et dans Safari iOS 16. Le serveur recalcule toujours le
  résultat ; le calcul du navigateur ne sert qu'à l'affichage.
- **Les participants n'ont pas de compte.** Aucune règle d'accès publique sur `sessions` ni `diagnostics` : le public
  passe par les routes `/api/app/*` de `diag.pb.js`, qui ne renvoient que des champs prévus pour lui. `users` ne
  contient que l'équipe (inscriptions fermées, comptes créés dans la console).
- **Rien de nominatif hors de l'équipe** : la vue salle n'agrège qu'à partir de 3 réponses ; le rapport ne se lit
  qu'avec son jeton (32 caractères, dans le fragment de l'adresse) et ne renvoie ni e-mail ni téléphone.
- **Pas de gain chiffré** dans les textes : règle de l'offre PerfIA v3, rien qui n'ait été mesuré chez le client.
- Hooks PocketBase : une VM par handler, `require()` à l'intérieur de chaque handler ; un champ JSON se lit avec
  `getString()` puis `JSON.parse`.
- Une nouvelle route publique reçoit une limite de débit dans une nouvelle migration.
- Toute modification de règle d'accès, de calcul, de route ou d'outil MCP vient avec un test dans `tests/api.test.mjs`.
- Collections : identifiants stables (`perfsessions001`, `perfdiagnost001`, `skelkeys0000001`, `skeloauth000001`).
  Après un changement de `pb_schema.json` : `make schema-import` en local, une nouvelle migration pour les instances
  déployées.

## Commandes

```bash
make dev           # PocketBase local (port PB_PORT, défaut 8090), console /_/
make demo          # compte d'équipe et session « demo » (variables de .local/env.sh)
make referentiel   # reconstruit le référentiel depuis content/
make test          # instance jetable + tests d'intégration
```

`.claude/launch.json` lance l'instance locale sur le port 8097 pour l'aperçu.

## Deployment Status

Préparé le 2026-10-15, pas encore déployé. Fiche : `docs/mise-en-ligne-coolify.md`.
- Deployment path: coolify
- Domain: à choisir (proposition : https://diag.kosm.io)
- Coolify resource: Docker Compose sur `mathieu-kosmio/perfia-eval` branche `main`, service `app` port 8090
- Auto-deploy on push: à décider
- Secrets à poser dans Coolify : APP_BREVO_API_KEY ; variables : APP_MAIL_FROM, APP_BREVO_LIST_ID (3)
- Superuser created: pending
- Console settings (Application name/URL, proxy headers, mail): pending
- S3 backups: pending
- E-mail channel: Brevo (compte « Kosmio Dev », expéditeur validé dev@kosm.io, liste 3 « PerfIA »)
- Image Docker : construite et testée en local le 2026-10-15
- Local env: .local/env.sh
