# Journal des versions

## 0.1.1 (2026-10-15)

**Modifié**
- Étape Maturité : un axe par écran, les 5 niveaux empilés et visibles d'un coup, passage automatique à l'axe suivant ;
  la question éclair devient un quatrième écran facultatif. Le carrousel horizontal est retiré.
- Finition : bandeau co-brandé toujours clair (mode sombre forcé désactivé), plus de flou ni de liseré latéral,
  priorités et légende en listes, échelle typographique fixe, espaces insécables, `Cache-Control: no-cache` sur les
  pages et scripts.

**Ajouté**
- Bouton *Renvoyer par e-mail* sur l'écran de fin et sur le rapport (`POST /api/app/report/{token}/email`, 3 fois au
  plus), adresse masquée dans le rapport.
- Inscription à la liste Brevo des invitations (`APP_BREVO_LIST_ID`, consentement 4 seulement, tâche
  `perfia_brevo` toutes les 10 minutes).
- Migration `1792100000_brevo.js` (champs `report_requests`, `brevo_synced_at`).
- E-mail de la feuille de route : bloc « Pour aller plus loin » (offres recommandées, bouton « Réserver 30 minutes »)
  et ressources, mise en page en tableau lisible sur mobile et dans Outlook.
- Attributs Brevo lus dans le compte (FIRSTNAME ou PRENOM, LASTNAME ou NOM, COMPANY, SOURCE) : seuls ceux qui existent
  sont envoyés.

## 0.1.0 (2026-10-15)

Première version de PerfIA Diagnostic IA, construite à partir du squelette Kosmio Skellyto 0.3.0
(`Kosmio/skeleton-pocketbase`).

**Ajouté**
- Parcours participant mobile en 5 étapes (Vous, Maturité, Cas d'usage, Priorité, Feuille de route), versions
  complète et courte, identité au début ou à la fin, reprise après fermeture, envoi rejoué si le réseau manque.
- Référentiel construit depuis `content/` : 3 axes de maturité à 5 niveaux, catalogues Bureau d'études, Construction
  bois, Scierie, Menuiserie et transversal (38 cas issus de la Processothèque), offres, ressources, vigilances.
- Règles de calcul partagées navigateur et serveur (`pb_hooks/scoring.js`), résultat recalculé par le serveur.
- Sessions par intervention (`/s/<code>`), vue salle avec QR code et agrégats anonymes à partir de 3 réponses.
- Rapport imprimable par jeton, envoi de la feuille de route par e-mail, notice sur les données personnelles.
- Page Équipe : sessions, liens et QR code, diagnostics, suivi des prospects, export CSV, clé MCP.
- Serveur MCP de l'équipe : `list_sessions`, `session_stats`, `list_diagnostics`, `get_diagnostic`,
  `set_lead_status`, prompt `preparer_relances`.
- Conservation : identité effacée après 12 mois sans accord de recontact, suppression après 36 mois.
- 31 tests d'intégration.

**Retiré du squelette**
- Multi-organisation par domaine d'e-mail, inscriptions publiques, publications, votes, commentaires, relecture,
  pièces jointes, équipes, progression, notifications, IA vocale, serveur MCP local.
