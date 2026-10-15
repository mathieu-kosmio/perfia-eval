# Accessibilité

Objectif : conformité RGAA 4.1 (WCAG 2.1 AA) sur le parcours, le rapport, la vue salle et la page Équipe.

## Ce qui est en place

**Contrastes.** Les jetons de `web/css/perfia.css` visent 4,5:1 pour le texte et 3:1 pour les composants. Le vert
Xylofutur `#00B194` (3:1 sur blanc) ne sert qu'aux aplats et aux graphiques ; le texte vert utilise `#00705F` sur fond
clair et `#5FD8C0` sur fond sombre. Les types de cas ne sont jamais signalés par la couleur seule : chaque puce porte
son libellé.

**Structure.** Un `h1` par étape, lien d'évitement « Aller au contenu », repère `main`, langue déclarée. À chaque
changement d'étape, le focus va sur le titre et la page remonte.

**Contrôles.** Cibles tactiles de 48 px au moins. Les contrôles composés ont un nom accessible explicite : axes
(groupe « Usages de l'IA »), familles (« … : 1 sur 3 sélectionné »), cas (`role="checkbox"` et
`aria-checked`). Étoiles et question éclair : groupes de boutons radio (`role="radiogroup"`, `aria-checked`).
Niveaux de maturité : groupe de boutons radio par axe (`aria-checked`). Accordéons avec `aria-expanded`, sous-choix avec
`aria-pressed`.

**Formulaires.** Étiquette reliée à chaque champ, champs obligatoires annoncés, erreurs liées par
`aria-describedby` et `aria-invalid`, premier champ en erreur ciblé.

**Graphiques.** Jauges d'effort et matrice décrites (`role="img"` et texte « Effort 2 sur 5 »), légende numérotée de
la matrice en liste, répartition de la vue salle décrite.

**Mouvement.** Animations coupées avec `prefers-reduced-motion`. Pas de défilement horizontal à 320 px de large.

## Comment vérifier

- `/accessibility` : axe-core sur chaque page.
- Parcours clavier complet du diagnostic, du rapport et de la page Équipe.
- Un passage avec VoiceOver sur iOS (usage principal : téléphone en salle).

## Ce qui reste à faire

- La déclaration d'accessibilité.
- Un audit avec lecteur d'écran de l'avancée automatique entre les axes de maturité.
