# Contenu et référentiel

Tout le contenu du diagnostic vient de deux fichiers de `content/`, assemblés par `make referentiel`.

## Les deux sources

**`content/processotheque.snapshot.json`** : instantané des 56 cas d'usage de la Processothèque PerfIA (nom,
description, catégorie, complexité technique, données nécessaires, limites, risques, statut, rattachements aux
processus et aux maillons). L'instantané actuel est une reconstitution des fichiers SQL du dépôt
`perfia-processotheque` au 15/10/2026 : il reflète les fichiers, pas la base de production, et contient des cas encore
en brouillon (`draft_ai`).

**`content/editorial.mjs`** : tout le reste.

| Export | Contenu |
|---|---|
| `APP` | nom, coédition, contact (reçoit aussi les réponses à la relance), lien de rendez-vous, durées annoncées, signature de la relance après session |
| `MAILLONS` | maillons proposés et catalogue associé (`bureau_etudes`, `construction_bois`, `scierie`, `menuiserie`, `transversal`) |
| `FONCTIONS`, `EFFECTIFS` | listes de l'étape « Vous » |
| `NIVEAUX` | noms des 5 niveaux (stades d'un peuplement : Semis, Fourré, Gaulis, Perchis, Futaie) |
| `AXES` | 3 axes (IA, Données, Cadre), 5 niveaux chacun : titre, étiquettes, 3 prochaines étapes |
| `PULSE_DEFAULT` | question éclair par défaut (celle du passeport de l'atelier IBC, pour comparer) |
| `TYPES` | IA, Automatisation, Données |
| `FAMILLES` | familles d'affichage, icône, fonctions pour lesquelles elles s'ouvrent en premier |
| `CATALOGUES` | par catalogue : familles et cas, sélection de la version courte (10 cas au plus) |
| `CASES` | par cas : libellé mobile (80 caractères), type, vigilance, `corpus`, `note_tpe` ; texte complet pour les cas « à créer » |
| `QUADRANTS`, `REGLES` | libellés des quadrants, seuils (priorité forte, effort faible, seuil de la vue salle) |
| `OFFRES`, `OFFRE_DEFAUT`, `RESSOURCES` | suites proposées et leurs conditions |
| `VIGILANCES` | points de vigilance et leurs conditions |

## Construire

```bash
make referentiel                                  # écrit les fichiers générés
node scripts/build-referentiel.mjs --check        # vérifie qu'ils sont à jour (lancé par make test)
node scripts/build-referentiel.mjs --strict       # échoue si un cas proposé n'est pas validé (avant publication)
```

Le script refuse : un cas absent de `CASES` ou de l'instantané, un libellé de plus de 80 caractères, un type
inconnu, un effort hors de 1 à 5, une famille vide, une version courte de plus de 10 cas, un axe sans 5 niveaux ou un
niveau sans 3 étapes.

La version du référentiel (`2026-10-15.<empreinte>`) change dès que le contenu change. Les diagnostics enregistrés
gardent la version utilisée ; un participant qui avait commencé avec une ancienne version recommence au début.

## Ajouter un cas d'usage

1. Le créer et le valider dans la Processothèque (gouvernance : rien de public avant validation).
2. Rafraîchir l'instantané (export depuis la Processothèque) ou, en attendant, le décrire entièrement dans `CASES`
   avec un code `NEW_…`, un `effort` estimé et `statut: "a_creer"`.
3. L'ajouter à une famille d'un ou plusieurs `CATALOGUES`, et à la version courte si besoin.
4. `make referentiel`, puis `make test`.

## Règles de calcul (rappel)

- Effort = complexité de la Processothèque, +1 pour un cas *Données* ou à corpus quand le niveau Données est de 2 ou
  moins.
- Priorité = étoiles ; 3 sans note.
- Quadrants : priorité 4 ou plus et effort 2 ou moins = *À tester tout de suite* ; priorité 4 ou plus et effort 3 ou
  plus = *À cadrer* ; sinon *Gains d'appoint* ou *Plus tard*.
- Offres, au plus 2 : *Déployer* (IA 4 et Cadre 4 au moins), *Accompagnement cas d'usage* (un cas à cadrer et
  Cadre 3 au moins), *Atelier découverte* (un cas à tester) ; *Atelier découverte* par défaut.
- Aucun prix affiché, aucun gain chiffré.

## Cas à valider dans la Processothèque

`node scripts/build-referentiel.mjs` liste les cas proposés qui ne sont pas validés. Au 15/10/2026 : 13 cas en
brouillon (dont les 3 cas bureau d'études et les cas transversaux issus des ateliers 2026) et 2 cas à créer (contrôle
de maquette BIM, métré depuis les plans).
