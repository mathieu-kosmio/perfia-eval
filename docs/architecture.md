# Architecture

## Vue d'ensemble

```
téléphone ── /s/<code> ── index.html + js/app.js ──┐
                                                    │  POST /api/app/diagnostics (public, recalculé côté serveur)
projecteur ─ salle.html (clé animateur) ────────────┤  GET  /api/app/sessions/<code>/live (agrégats ≥ 3)
équipe ───── equipe.html (compte users) ────────────┤  REST /api/collections/* (règles « équipe »), export CSV
agent IA ─── /mcp (clé ak_ ou OAuth) ───────────────┤
                                                    ▼
                            PocketBase (un binaire, SQLite) ── pb_hooks/ ── Brevo (e-mails)
                                     │
                                     └── volume pb_data (données, fichiers, sauvegardes)
```

Un seul processus sert les pages (fichiers statiques de `web/`), l'API REST, les routes métier des hooks, le serveur
MCP et la console d'administration.

## Les trois publics

| Public | Authentification | Accès |
|---|---|---|
| Participant | aucune | routes publiques de `diag.pb.js` : session ouverte, dépôt, rapport par jeton |
| Animateur | clé de session (en-tête `X-Presenter-Key`) | agrégats anonymes de sa session |
| Équipe | compte `users` vérifié, créé dans la console | sessions et diagnostics par l'API REST, export, MCP |

Les participants n'ont jamais de compte : aucune vérification d'adresse, aucun lien qui expire avant la fin du
parcours. Les règles d'accès des collections ne laissent rien au public ; seules les routes métier lui répondent, avec
des champs choisis.

## Référentiel et calcul

```
content/editorial.mjs + content/processotheque.snapshot.json
        │  make referentiel (scripts/build-referentiel.mjs)
        ├──> web/content/referentiel.json        lu par les pages
        ├──> pocketbase/pb_hooks/referentiel.js  lu par les hooks
        └──> web/js/scoring.js                   copie de pocketbase/pb_hooks/scoring.js
```

`scoring.js` porte toutes les règles : catalogue selon le maillon, ordre des familles selon la fonction, effort,
quadrants, offres, ressources, vigilances, agrégats de la vue salle, validation. Le navigateur calcule pour afficher
la feuille de route sans attendre ; le serveur valide et recalcule, et c'est son résultat qui est enregistré.

Chaque diagnostic garde la version du référentiel utilisée (`referentiel_version`).

## Parcours

Le parcours tient dans `web/js/app.js` : un état, une fonction de rendu par étape, un gestionnaire d'événements
délégué. La progression est gardée dans le stockage local du navigateur (reprise après fermeture). Le diagnostic est
envoyé à l'entrée de la feuille de route ; si le réseau manque, il reste en attente sur l'appareil et l'envoi est
rejoué (bouton, ou au prochain chargement).

## Tâches planifiées

| Tâche | Fréquence | Rôle |
|---|---|---|
| `perfia_reports` | chaque minute | envoie les feuilles de route en attente (20 par passage, 3 essais) ; `APP_SEND_REPORTS=0` la coupe |
| `perfia_retention` | chaque nuit | efface l'identité après 12 mois sans accord de recontact, supprime après 36 mois |
| `perfia_purge_unverified` | chaque nuit | supprime les comptes d'équipe jamais vérifiés (héritée du squelette) |

## Pourquoi PocketBase

Un conteneur, un volume, pas de base à opérer ; règles d'accès, API, console et sauvegardes fournies. Le MOOC PerfIA
tourne déjà sur PocketBase. Limite assumée : une seule instance (SQLite), largement suffisante pour quelques milliers
de diagnostics par an.
