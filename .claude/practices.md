# Pratiques du projet : PerfIA Diagnostic IA

Lire `CLAUDE.md` d'abord. Guides détaillés :

- `ai/POCKETBASE_PRACTICES.md` : schéma, règles d'accès, hooks, migrations, tests
- `ai/WEB_PRACTICES.md` : pages sans build, jetons CSS, accessibilité, stockage local
- `ai/MCP_PRACTICES.md` : serveur MCP de l'équipe, clés, OAuth
- `ai/INFRA_PRACTICES.md` : Dockerfile, Coolify, Compose et Traefik, CI, sauvegardes

## Règles clés

**Données et accès**
- Toutes les règles d'accès vivent dans `pocketbase/pb_schema.json`. `sessions` et `diagnostics` ne sont lisibles que
  par l'équipe (`@request.auth.collectionName = "users"`) ; le public passe par les routes de `diag.pb.js`.
- `users` = équipe seulement : `createRule` nulle, comptes créés dans la console, adresse vérifiée exigée.
- Champs masqués (`hidden`) : `diagnostics.token`, `sessions.presenter_key`, `api_keys.hash`. Un test vérifie leur
  absence des réponses de l'API.
- Refus : 404 pour une lecture ou une modification exclue par une règle, 400 pour une création refusée, 403 pour une
  règle nulle.

**Contenu et calcul**
- `content/` est la source ; `make referentiel` produit les fichiers générés ; les tests vérifient qu'ils sont à jour.
- `pocketbase/pb_hooks/scoring.js` est la seule implémentation des règles ; le serveur recalcule toujours.
- Avant une mise en ligne publique : `node scripts/build-referentiel.mjs --strict` (tous les cas validés dans la
  Processothèque).

**Sécurité**
- Toute nouvelle route publique : validation côté serveur, réponse sans donnée nominative, limite de débit par
  migration, test du chemin refusé.
- Le jeton du rapport et la clé animateur ne passent jamais dans une adresse envoyée au serveur : fragment (`#`) pour
  le rapport, en-tête `X-Presenter-Key` pour la vue salle.
- Les secrets ne sont jamais versionnés : `.local/env.sh` en local, secrets Coolify ou GitHub ailleurs.

**Interface**
- Pas de build, pas de dépendance chargée depuis un tiers, pas de police externe.
- Couleurs uniquement par jetons (`web/css/perfia.css`). Contraste 4,5:1 pour le texte, 3:1 pour les composants.
- Contrôles accessibles : boutons de taille 48 px au moins, `aria-checked` / `aria-pressed` / `aria-expanded`, nom
  accessible explicite, focus visible, `prefers-reduced-motion`.
- Textes en français, sans tiret cadratin.

## Skills

`/deploy`, `/setup-deploy`, `/quality`, `/accessibility`, `/ecoconception`, `/gdpr`, `/security`, `/ux-designer`.
Ils viennent du squelette : leurs exemples parlent parfois d'organisations ou de publications ; pour ce projet, le
modèle de référence est `docs/modele-de-donnees.md` et le modèle de sécurité `docs/securite.md`.
