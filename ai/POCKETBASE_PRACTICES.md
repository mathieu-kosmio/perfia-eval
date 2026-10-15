# Pratiques PocketBase

Schéma, règles d'accès, hooks, migrations et tests de PerfIA Diagnostic IA. Modèle détaillé :
`docs/modele-de-donnees.md`.

## Organisation

```
pocketbase/
├── pb_schema.json            collections et règles d'accès (source de vérité)
├── pb_migrations/            1757500000 import du schéma · 1757600000 nom de l'application · 1792000000 limitation de débit
└── pb_hooks/
    ├── scoring.js            règles de calcul (source unique, recopiée dans web/js/scoring.js)
    ├── referentiel.js        GÉNÉRÉ par scripts/build-referentiel.mjs
    ├── domain.js             point unique métier : statuts, conservation, e-mail du rapport, export, consignes MCP
    ├── diag.js / diag.pb.js  sessions, dépôt, rapport, vue salle, export, tâches planifiées
    ├── mcp.js / mcp.pb.js    serveur MCP de l'équipe
    ├── oauth.js / oauth.pb.js
    ├── account.js / account.pb.js
    ├── mail.pb.js            relais Brevo
    └── headers.pb.js         en-têtes de sécurité
```

## Collections et identifiants

| Collection | Id | Règles |
|---|---|---|
| `users` | `_pb_users_auth_` | équipe seulement ; `createRule` nulle ; chacun voit son compte ; `authRule = "verified = true"` |
| `sessions` | `perfsessions001` | tout réservé à l'équipe (`@request.auth.collectionName = "users"`) |
| `diagnostics` | `perfdiagnost001` | lecture, suivi, suppression : équipe ; création : route de dépôt seulement ; `token`, `result`, `levels`, `cases` non modifiables |
| `api_keys` | `skelkeys0000001` | ses propres clés |
| `oauth_clients` | `skeloauth000001` | hooks seulement |

Les identifiants sont stables : ne jamais les régénérer. Un champ ne se renomme pas dans `pb_schema.json` (perte de
données) : passer par une migration.

## Règles d'accès

- Le public n'a aucune règle ouverte. Il passe par les routes `/api/app/*` de `diag.pb.js`, qui sélectionnent les
  champs renvoyés.
- `""` (règle vide) signifie public : ne jamais l'utiliser sur `sessions` ou `diagnostics`.
- Codes de refus : 404 pour une lecture ou une modification exclue, 400 pour une création refusée, 403 pour une règle
  nulle.
- Champs masqués (`hidden`) : `diagnostics.token`, `sessions.presenter_key`, `api_keys.hash`. Les hooks les voient ;
  l'API ne les renvoie jamais, sauf au superutilisateur.

## Hooks

- Un handler de `*.pb.js` tourne dans sa propre VM : pas de constante ni de fonction au niveau du fichier ; la logique
  partagée vit dans des modules `*.js` chargés par `require(`${__hooks}/x.js`)` dans chaque handler.
- Un champ JSON se lit avec `record.getString("levels")` puis `JSON.parse` (`json()` dans `diag.js`).
- Les hooks contournent les règles (`app.save`, `findRecordsByFilter`) : une fonction appelée par une route publique
  ne renvoie que des champs prévus pour le public.
- Requêtes SQL : paramètres liés (`{:name}`), jamais de concaténation de valeurs venues du client.
- Secrets et codes : `$security.randomStringWithAlphabet()`, jamais `Math.random()`.
- Messages d'erreur en français, affichables tels quels.
- Journaux : `app.logger()`, jamais de jeton, de clé ni de corps de requête complet.

## Migrations

`1757500000_import_schema.js` importe `pb_schema.json` au premier démarrage (sans supprimer les collections
existantes). Toute évolution ultérieure passe par une nouvelle migration, horodatée après la dernière, **et** par
`pb_schema.json` (une installation neuve importe le schéma courant puis rejoue les migrations suivantes). Les limites
de débit sont un réglage d'instance : une nouvelle route publique reçoit sa limite dans une nouvelle migration.

`make dev` et `make test` lancent PocketBase avec `--automigrate=false` : la console ne génère pas de migration.

## Tests

`make test` : vérifie le référentiel (`build-referentiel.mjs --check`), lance une instance jetable avec
`APP_SEND_REPORTS=0`, crée un superutilisateur, exécute `tests/api.test.mjs`. Les tests partagent des fixtures (compte
d'équipe, session, jeton) et s'exécutent dans l'ordre du fichier.

Toute modification de règle, de route, de calcul ou d'outil MCP vient avec un test du chemin autorisé et du chemin
refusé, avec le code exact. Le test MCP vérifie la liste exacte des outils.
