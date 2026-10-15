# Pratiques web

Pages de PerfIA Diagnostic IA : HTML, CSS et JavaScript natifs, sans build.

## Pages et scripts

| Page | Script | Thème |
|---|---|---|
| `index.html` | `js/app.js` | sombre |
| `rapport.html` | `js/rapport.js` | clair, imprimable A4 |
| `salle.html` | `js/salle.js` | sombre, grand écran |
| `equipe.html` | `js/equipe.js` | clair |
| `donnees.html` | aucun | clair |

Partagés : `css/perfia.css` (jetons et composants), `js/ui.js` (`window.PerfiaUI` : icônes, illustrations des niveaux,
jauge, matrice, QR code, réseau, stockage local), `js/scoring.js` (généré, `window.PerfiaScoring`),
`content/referentiel.json` (généré), `vendor/qrcode.js` (bibliothèque MIT intégrée).

## Règles

- **Pas de build, pas de tiers.** Aucun script, police ni feuille de style chargé depuis un autre domaine. Une
  bibliothèque nécessaire s'intègre dans `vendor/`, version figée, licence en tête de fichier.
- **Jetons.** Toute couleur passe par une variable de `perfia.css` ; le thème sombre se déclare avec
  `<body class="dark">`. Contraste 4,5:1 pour le texte, 3:1 pour les composants.
- **Rendu.** Chaque page a un état et une fonction de rendu ; les événements passent par un gestionnaire délégué
  (`data-action`). Toute valeur affichée passe par `esc()`. Le rendu garde le focus grâce à `data-key`.
- **Accessibilité.** Cibles de 48 px, nom accessible explicite sur les contrôles composés, `aria-checked`,
  `aria-pressed`, `aria-expanded`, groupes de radios pour les échelles, focus visible, focus déplacé sur le titre à
  chaque étape, `prefers-reduced-motion`.
- **Stockage local.** Seulement pour le confort (reprise du parcours, envoi en attente), toujours dans un
  `try/catch` ; la page fonctionne sans. Clé : `perfia-diag:<code de session ou web>`. Le jeton d'équipe reste dans
  `sessionStorage`.
- **Secrets dans l'adresse.** Le jeton du rapport et la clé animateur vivent dans le fragment (`#`), jamais dans la
  requête ; la clé animateur part dans l'en-tête `X-Presenter-Key`.
- **Compatibilité.** Safari iOS 16 et Chrome Android récents : pas de syntaxe plus récente que ce qu'ils lisent.
  `scoring.js` reste en JavaScript simple (il tourne aussi dans la VM de PocketBase).
- **Textes.** Français, vouvoiement, phrases courtes, pas de tiret cadratin, aucun gain chiffré non mesuré.
