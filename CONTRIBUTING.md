# Contribuer à PerfIA Diagnostic IA

Merci de vous intéresser au squelette. Ce guide explique son esprit, comment l'installer, le tester et proposer un
changement. En participant, vous acceptez le [code de conduite](CODE_OF_CONDUCT.md).

- [Esprit du projet](#esprit-du-projet)
- [Comment aider](#comment-aider)
- [Installer](#installer)
- [Tester](#tester)
- [Conventions](#conventions)
- [Proposer un changement](#proposer-un-changement)
- [Publier une version](#publier-une-version)

## Esprit du projet

PerfIA Diagnostic IA cherche la simplicité maximale pour une application IA : un binaire, un fichier HTML, pas d'étape de build,
pas de framework côté navigateur. Avant d'ajouter une dépendance ou une couche, vérifier qu'elle apporte plus qu'elle
ne coûte à quelqu'un qui découvre le dépôt. Un changement dans le squelette profite à tous les projets qui en
partiront : il doit rester générique.

Règles de fond, à ne pas changer sans discussion préalable dans une issue :

- l'isolation entre organisations repose sur les règles d'accès de `pb_schema.json`, jamais sur l'interface ;
- un compte ne voit rien tant que son adresse n'est pas vérifiée ;
- tout ce qui dépend de l'entité métier passe par `pocketbase/pb_hooks/domain.js` et le bloc `APP` de
  `web/index.html` ;
- les clés IA ne quittent jamais le serveur ;
- aucune donnée nominative ni aucun contenu ne sort de l'organisation, y compris sur la page d'accueil.

## Comment aider

- **Signaler un bogue** : issue « Bogue », avec les étapes pour reproduire.
- **Proposer une évolution** : issue « Évolution », en partant du besoin rencontré dans un vrai projet.
- **Signaler une faille** : jamais en issue, voir [SECURITY.md](SECURITY.md).
- **Améliorer la documentation** : une pull request suffit, sans issue préalable.

## Installer

Prérequis : Node.js 22, 24 ou 26 (lignes maintenues), `curl` et `unzip`. Docker n'est utile que pour construire l'image.

```bash
git clone https://github.com/Kosmio/Lightweight-skeleton.git perfia-eval && cd perfia-eval
mkdir -p .local && printf 'PB_ADMIN_EMAIL=vous@exemple.fr\nPB_ADMIN_PASSWORD=un-mot-de-passe-local\n' > .local/env.sh
make dev
```

`make dev` télécharge PocketBase dans `.local/` (archive vérifiée par SHA-256), applique les migrations et sert
l'application sur http://127.0.0.1:8090. Hooks et interface se rechargent à chaud ; un changement de variable
d'environnement demande un redémarrage.

Créer un compte avec un domaine professionnel fictif (`vous@acme.test`), puis l'activer sans e-mail :

```bash
make verify-user EMAIL=vous@acme.test
```

Avant de toucher au code, lire [.claude/practices.md](.claude/practices.md) : il résume les règles et renvoie vers
les guides détaillés de `ai/`.

## Tester

```bash
make test
```

`scripts/test.sh` lance une instance PocketBase jetable (port libre, dossier temporaire) avec les hooks et les
migrations du dépôt, un faux fournisseur IA local, puis `node --test tests/api.test.mjs`. Aucune clé réelle, aucun
appel externe. Le même test tourne dans GitHub Actions sur chaque push et pull request.

Doit venir avec un test :

- toute règle d'accès, route, outil MCP, étape OAuth ou modification du barème ;
- tout correctif de sécurité : le test rejoue l'attaque et doit échouer sans le correctif.

Les tests partagent une instance et s'exécutent dans l'ordre du fichier. Créez vos propres comptes avec un suffixe
`RUN` plutôt que de modifier `alice`, `bob` ou `carol`. Le test de limitation de débit reste le dernier du fichier.

Pour l'interface, vérifier au navigateur les parcours principaux dans les deux thèmes et à 320 px de large, et lancer
`/accessibility`.

## Conventions

**Langue et textes**
- Interface, documentation et commentaires en français ; identifiants en anglais.
- Pas de tiret cadratin dans les textes : deux-points, point-virgule ou virgule.

**Backend**
- Le schéma évolue par migrations : `pocketbase/pb_migrations/<horodatage unix>_<objet>.js`, horodatage croissant,
  migration inoffensive si rejouée sur une base déjà à jour. Mettre aussi à jour `pb_schema.json`.
- Les identifiants de collections ne changent jamais.
- Logique partagée entre hooks dans des modules `*.js` chargés par `require()` à l'intérieur des handlers.

**Interface**
- Couleurs et espacements par les jetons CSS, jamais en dur ; contrastes 4,5:1 pour le texte, 3:1 pour les
  composants, dans les deux thèmes.
- Tout contenu venant d'un utilisateur ou de l'IA passe par `esc()` avant `innerHTML`.
- Toute action a un état accessible (`aria-pressed`, `aria-expanded`, libellé explicite) et un retour visible.

**Infrastructure**
- Le `Dockerfile` racine et `infra/docker/app/Dockerfile` restent identiques (la CI le vérifie).
- Dans un workflow, une entrée utilisateur passe par `env:`, jamais par `${{ }}` au milieu d'un script.

**Commits**
- Un commit, un sujet. Titre à l'impératif ou nominal, en français, 72 caractères au plus
  (`MCP : borne les lots à 20 messages`), corps qui explique le pourquoi.

## Proposer un changement

1. Ouvrir une issue pour décrire le besoin, avec le contexte du projet qui l'a fait apparaître (sauf documentation
   et correctifs évidents).
2. Créer une branche depuis `main`, faire le changement, ajouter ou adapter tests et documentation.
3. Ajouter une ligne dans la section en cours de [CHANGELOG.md](CHANGELOG.md).
4. Ouvrir une pull request courte en suivant le modèle : quoi, pourquoi, comment c'est vérifié.
5. La CI doit être verte. Une personne qui maintient le projet relit ; les échanges portent sur le code, pas sur les
   personnes.

## Publier une version

Réservé aux mainteneurs.

1. Choisir le numéro selon [Semantic Versioning](https://semver.org/lang/fr/) et l'écrire dans `VERSION`.
2. Si les outils MCP changent : `VERSION` de `pocketbase/pb_hooks/mcp.js`, `mcp/package.json` et `mcp/server.js`.
3. Mettre à jour PocketBase : `PB_VERSION` et les empreintes `PB_SHA256_*` des deux Dockerfiles (fichier
   `checksums.txt` de la release), `PB_VERSION` de `scripts/pb.sh`.
4. Mettre à jour le SDK PocketBase : version et attribut `integrity` dans `web/index.html` et
   `pocketbase/pb_hooks/oauth.js` :
   ```bash
   curl -fsSL https://cdn.jsdelivr.net/npm/pocketbase@<version>/dist/pocketbase.umd.js | openssl dgst -sha384 -binary | openssl base64 -A
   ```
5. Dater la section de `CHANGELOG.md`, avec une rubrique « Mise à niveau » dès qu'une migration ou un comportement
   change.
6. `make test`, commit, tag `v<version>`, push. `dev.yml` publie l'image `<slug>-app:<version>`.
7. Correctif de sécurité : publier un avis GitHub (Security > Advisories) qui liste les fichiers et migrations à
   reporter dans les projets dérivés.
