# Design

## Principes repris du design de référence

Le parcours reprend les principes d'interaction d'un outil de diagnostic tiers (captures fournies le 15/10/2026,
non versionnées), sans sa marque, ses textes ni ses illustrations :

- indicateur en 5 pastilles numérotées et libellées, cochées une fois franchies ;
- fond en dégradé sombre, cartes translucides, titre centré et sous-titre en italique de couleur accent ;
- boutons *Précédent* (contour) et *Suivant* (plein), larges ;
- maturité : d'abord une carte repliable par axe avec un carrousel de niveaux ; remplacé le 15/10/2026 par un axe
  par écran, les 5 niveaux empilés (voir ci-dessous) ;
- cas d'usage : familles en accordéon avec icône et compteur, compteur global ;
- priorité : 5 étoiles par cas ;
- feuille de route : étapes numérotées par axe, tableaux par type avec jauge d'effort, matrice à bulles et légende
  numérotée E/P, écran de remerciement avec rapport et PDF ;
- rapport : vue document et bouton *Imprimer / PDF*.

Ajouts propres à PerfIA : sous-choix *Je voudrais* / *Déjà en place*, détail de chaque cas (données nécessaires,
vigilance), question éclair, quadrants nommés avec le vocabulaire des ateliers, offres, vue salle.

## Identité

Charte co-brandée PerfIA (Kosmio × Xylofutur), source `112-PerfIA-Bois/design-system/tokens.css` :

| Jeton | Valeur | Usage |
|---|---|---|
| `--xf-green-500` | `#00B194` | aplats, boutons, graphiques (jamais en texte sur fond clair : 3:1) |
| `--xf-green-700` | `#00705F` | texte et contours verts sur fond clair |
| `--xf-gold-500/600` | `#BA8748` / `#9F7338` | type *Automatisation*, étoiles sur fond clair |
| `--km-sage-500/600` | `#7C9E98` / `#65857F` | type *Données* |
| `--ink-900` | `#1F2D3D` | fond sombre, texte sur fond clair |

Titres en Helvetica Neue, texte en Inter si installée (sinon Helvetica, Arial), micro-libellés en police à chasse
fixe. Aucune police téléchargée.

Logos : Kosmio officiels (`01-Strategie/design-system/assets-marque/logos/`), Xylofutur et PerfIA du site public ;
dans `web/assets/logos/`. En-tête : PerfIA à gauche, puis Kosmio ✕ Xylofutur, puis le logo de l'organisateur de la
session s'il est fourni.

## Étape Maturité

Un axe par écran : repère « Axe 1 sur 3 », la question en titre, puis les 5 niveaux empilés (illustration, nom,
numéro, une phrase) dans un groupe de boutons radio. Un toucher sélectionne et passe à l'axe suivant après 320 ms ;
*Précédent* revient à l'axe d'avant avec son choix. La question éclair forme un quatrième écran, facultatif
(*Passer*). Raison : sur téléphone, le carrousel ne montrait qu'un niveau sur cinq et imposait un glissement
horizontal dans une page verticale.

## Illustrations des niveaux

Cinq dessins au trait générés en SVG (`stage()` dans `web/js/ui.js`) : les stades de croissance d'un peuplement
forestier, du semis à la futaie. Ils prennent la couleur du texte : vert sur fond sombre, vert foncé sur fond clair.

## Thèmes

Parcours et vue salle en thème sombre (`<body class="dark">`), rapport, notice et page Équipe en thème clair. La
feuille d'impression du rapport est claire, en A4.

**Aucune page ne suit le thème du système.** Chaque page déclare `<meta name="color-scheme" content="only light">` et
`:root { color-scheme: only light }`, ce qui désactive aussi le mode sombre forcé des navigateurs (Chrome Android,
par exemple). Le bandeau co-brandé est toujours clair, avec les logos officiels en couleur
(`.brandbar { color-scheme: only light; forced-color-adjust: none }`). Les contrôles natifs du parcours (listes
déroulantes) passent en sombre grâce à `body.dark { color-scheme: dark }`.

## Règles de finition

- Pas de blanc ni de noir purs : neutres teintés vers le vert de la marque (`--paper`, `--bandeau`, en OKLCH).
- Pas de liseré latéral coloré sur les cartes ou les titres : aplat teinté (`.offer`) ou repère carré (titres du
  rapport).
- Pas de flou décoratif sur les cartes ; pas de carte dans une carte (légende de la matrice et priorités en lignes).
- Échelle typographique fixe (`.screen-title` 1,875 rem, `.section-title` 1,5 rem, `.card-title` 1,0625 rem) ; texte
  courant de 14 px au moins sur mobile.
- Transitions de 180 ms en ease-out-quart (`--dur`, `--ease-out`), survol réservé aux pointeurs fins.
- Espaces insécables automatiques avant `: ; ! ? »` et après `«` (`typo()` dans `web/js/ui.js`).
- Pages, scripts et styles servis avec `Cache-Control: no-cache` : jamais d'ancienne version après une mise à jour.

## Accessibilité

Voir `docs/accessibilite.md`. Cibles tactiles de 48 px, noms accessibles explicites sur les contrôles composés
(axes, niveaux, familles, cas), groupes de boutons radio pour les étoiles et la question éclair, jauges et matrice
doublées d'un texte, focus déplacé sur le titre à chaque étape, mouvement réduit respecté.
