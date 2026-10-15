# PerfIA Diagnostic IA

Diagnostic de maturité IA sur mobile pour la filière forêt-bois, co-édité par Kosmio et Xylofutur, opéré par Kosmio.

Pendant une intervention (atelier, visio, salon), chaque participant scanne un QR code et fait le diagnostic sur son
téléphone en 3 à 7 minutes. Il repart avec une feuille de route personnelle (PDF, e-mail). L'équipe Kosmio repart
avec des prospects qualifiés. La vue salle projette les résultats anonymes du public. Hors intervention, le même lien
sert de porte d'entrée à l'offre PerfIA.

Spécification : [docs/specification.md](docs/specification.md).

## Ce que fait l'application

| Pour qui | Page | Ce qu'on y fait |
|---|---|---|
| Participant | `/` ou `/s/<code>` | Parcours en 5 étapes : Vous, Maturité (3 axes, 5 niveaux), Cas d'usage (selon le maillon), Priorité, Feuille de route ; puis rapport et offres |
| Participant | `/rapport.html#<jeton>` | Rapport imprimable en PDF, valable 12 mois |
| Animateur | `/salle.html#<code>:<clé>` | Vue à projeter : QR code, nombre de réponses, niveaux moyens comparés à une mesure de référence, cas les plus choisis, matrice de la salle (rien sous 3 réponses) |
| Équipe | `/equipe.html` | Sessions (création, ouverture, liens, QR code), diagnostics et suivi des prospects, export CSV, clé pour un agent IA |
| Agent IA de l'équipe | `/mcp` | Serveur MCP : sessions, statistiques, prospects, mise à jour du suivi |

Les cas d'usage viennent de la Processothèque PerfIA. Le catalogue proposé dépend du maillon déclaré : bureau
d'études, construction bois, scierie, menuiserie, ou un catalogue transversal pour les autres maillons. La famille
liée à la fonction du répondant s'ouvre en premier.

## Stack

| Couche | Technologie |
|---|---|
| Backend | PocketBase 0.40 (un binaire Go, SQLite), hooks JavaScript |
| Interface | HTML, CSS et JavaScript natifs, sans build ni dépendance (QR code : `qrcode-generator`, MIT, intégré dans `web/vendor/`) |
| Contenu | Référentiel JSON versionné, construit depuis `content/` |
| E-mails | Relais Brevo (API) ou SMTP |
| Agents | Serveur MCP Streamable HTTP, clés personnelles et OAuth 2.1 |
| Tests | `node:test` sur une instance PocketBase jetable |
| Déploiement | Une image Docker, Coolify (recommandé) ou Docker Compose et Traefik |

Le socle vient du squelette Kosmio [`skeleton-pocketbase`](https://github.com/Kosmio/skeleton-pocketbase) (Skellyto,
MIT), allégé : plus de multi-organisation, de votes, de commentaires, de progression ni d'IA vocale.

## Démarrage local

Prérequis : Node.js 20 ou plus, `curl`, `unzip`.

```bash
mkdir -p .local && printf 'PB_ADMIN_EMAIL=admin@exemple.test\nPB_ADMIN_PASSWORD=un-mot-de-passe-local\nPB_PORT=8097\nSTAFF_EMAIL=equipe@exemple.test\nSTAFF_PASSWORD=un-autre-mot-de-passe\nAPP_SEND_REPORTS=0\n' > .local/env.sh
make dev
```

Dans un second terminal, créer le compte d'équipe et la session de démonstration :

```bash
make demo
```

Les liens s'affichent : participants (`/s/demo`), vue salle, page Équipe. Console d'administration : `/_/`.

```bash
make test
```

## Modifier le contenu

Axes, niveaux, catalogues, libellés, offres et vigilances se modifient dans `content/editorial.mjs`. Les textes longs
des cas viennent de `content/processotheque.snapshot.json`. Après toute modification :

```bash
make referentiel
```

Détails : [docs/contenu.md](docs/contenu.md).

## Documentation

- [Spécification](docs/specification.md)
- [Contenu et référentiel](docs/contenu.md)
- [Architecture](docs/architecture.md)
- [Modèle de données](docs/modele-de-donnees.md)
- [Sécurité et données personnelles](docs/securite.md)
- [Serveur MCP](docs/mcp.md)
- [Design](docs/design.md)
- [Déploiement](docs/deploiement.md)

## Licence

MIT, voir [LICENSE](LICENSE). Contenu PerfIA (référentiel, textes, logos) : Kosmio et Xylofutur, tous droits réservés.
