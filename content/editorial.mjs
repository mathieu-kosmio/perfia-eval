/**
 * PerfIA Diagnostic IA : couche éditoriale du référentiel.
 *
 * Tout ce que la Processothèque ne porte pas vit ici : maillons, axes et niveaux de maturité, familles
 * d'affichage, choix des cas par profil, libellés courts pour mobile, type de chaque cas, vigilances, offres.
 * Les textes longs des cas (description, données nécessaires) viennent de content/processotheque.snapshot.json.
 *
 * Après toute modification : `make referentiel` (régénère web/content/referentiel.json et
 * pocketbase/pb_hooks/referentiel.js). Les tests échouent si le référentiel construit n'est pas à jour.
 */

export const APP = {
  name: "PerfIA Diagnostic IA",
  tagline: "Votre feuille de route IA, filière forêt-bois",
  coedition: "Co-édité par Kosmio et Xylofutur · Dispositif opéré par Kosmio",
  contact: "mathieu@kosm.io",
  rdv_url: "https://cal.com/kosmio/ia-automatisation",
  site_url: "https://ia-automatisation.kosm.io",
  duree: { court: "3 minutes", complet: "5 à 7 minutes" },
  // Signature de la relance envoyée après une session ; les réponses à ce message arrivent à `contact`.
  signature: { nom: "Mathieu Pesin", role: "Associé, Kosmio" },
};

/* ---------- Profil du répondant ---------- */

export const MAILLONS = [
  { code: "bureau_etudes", label: "Bureau d'études bois, ingénierie", catalogue: "bureau_etudes" },
  { code: "construction_bois", label: "Construction bois, charpente", catalogue: "construction_bois" },
  { code: "scierie", label: "Scierie, première transformation", catalogue: "scierie" },
  { code: "menuiserie", label: "Menuiserie, agencement, ameublement", catalogue: "menuiserie" },
  { code: "exploitant_forestier", label: "Exploitation forestière, sylviculture", catalogue: "transversal" },
  { code: "negoce", label: "Négoce, distribution", catalogue: "transversal" },
  { code: "transport", label: "Transport, logistique bois", catalogue: "transversal" },
  { code: "panneaux", label: "Industrie des panneaux", catalogue: "transversal" },
  { code: "bois_energie", label: "Bois-énergie", catalogue: "transversal" },
  { code: "institution", label: "Pôle, fédération, collectivité, formation", catalogue: "transversal" },
  { code: "autre", label: "Autre ou plusieurs maillons", catalogue: "transversal" },
];

export const FONCTIONS = [
  { code: "direction", label: "Direction" },
  { code: "be_technique", label: "Bureau d'études, technique" },
  { code: "commerce", label: "Commerce, chiffrage" },
  { code: "admin", label: "Administratif, finance" },
  { code: "production", label: "Production, atelier ou chantier" },
  { code: "autre", label: "Autre" },
];

export const EFFECTIFS = [
  { code: "1-5", label: "1 à 5 personnes" },
  { code: "6-20", label: "6 à 20 personnes" },
  { code: "21-50", label: "21 à 50 personnes" },
  { code: "51-250", label: "51 à 250 personnes" },
  { code: "250+", label: "Plus de 250 personnes" },
];

/* ---------- Maturité : 3 axes, 5 niveaux ---------- */

// Les stades de croissance d'un peuplement forestier donnent leur nom aux niveaux.
export const NIVEAUX = [
  { n: 1, nom: "Semis", idee: "On n'a pas commencé" },
  { n: 2, nom: "Fourré", idee: "Des essais isolés" },
  { n: 3, nom: "Gaulis", idee: "Un usage régulier, encore individuel" },
  { n: 4, nom: "Perchis", idee: "Des pratiques partagées et outillées" },
  { n: 5, nom: "Futaie", idee: "Intégré, piloté, durable" },
];

export const AXES = [
  {
    code: "ia",
    label: "Usages de l'IA",
    court: "IA",
    question: "Où en sont vos usages de l'IA ?",
    levels: [
      { n: 1, titre: "L'IA, on n'y touche pas encore", tags: ["Jamais ou presque"],
        steps: ["Tester un assistant IA sur un écrit non confidentiel.", "Apprendre à donner du contexte et à relire ce qu'il produit.", "Noter trois tâches répétitives de votre semaine."] },
      { n: 2, titre: "Quelques essais, chacun de son côté", tags: ["Usage ponctuel", "Chat"],
        steps: ["Choisir une tâche et la refaire chaque semaine avec l'IA.", "Garder les consignes qui marchent.", "Savoir quels documents on peut lui confier."] },
      { n: 3, titre: "Un usage régulier au poste de travail", tags: ["Chaque semaine", "Consignes réutilisées"],
        steps: ["Partager les meilleures consignes dans l'équipe.", "Passer à un assistant qui lit vos documents maison.", "Mesurer le temps avant et après sur un cas."] },
      { n: 4, titre: "Des assistants partagés dans l'équipe", tags: ["Agents partagés", "Documents maison"],
        steps: ["Brancher un cas sur un vrai processus, avec validation humaine.", "Suivre le coût par tâche réussie.", "Réduire la dépendance à un seul fournisseur."] },
      { n: 5, titre: "L'IA intégrée dans vos processus", tags: ["Harnais", "En production"],
        steps: ["Industrialiser les cas qui ont fait leurs preuves.", "Tenir un tableau de bord de 5 à 7 indicateurs.", "Partager vos retours avec la filière."] },
    ],
  },
  {
    code: "donnees",
    label: "Données et documents",
    court: "Données",
    question: "Où en sont vos données et vos documents ?",
    levels: [
      { n: 1, titre: "Dans les têtes et sur papier", tags: ["Papier", "Mémoire"],
        steps: ["Inventorier vos documents récurrents.", "Numériser un modèle maison par type de document.", "Choisir un espace de stockage partagé."] },
      { n: 2, titre: "Des fichiers épars", tags: ["Excel", "Mails", "Dossiers"],
        steps: ["Ranger : une arborescence et un nommage communs.", "Écrire vos modèles de documents.", "Repérer les ressaisies entre logiciels."] },
      { n: 3, titre: "Des outils métier", tags: ["Logiciels métier", "Serveur"],
        steps: ["Structurer : des exports réguliers de vos logiciels.", "Constituer un corpus de référence (normes, modèles, projets).", "Protéger : savoir ce qui est confidentiel."] },
      { n: 4, titre: "Des données consolidées", tags: ["Historique fiable", "Tableaux de bord"],
        steps: ["Rendre le corpus exploitable par l'IA, avec ses sources.", "Suivre la qualité des données clés.", "Relier vos outils plutôt que ressaisir."] },
      { n: 5, titre: "Des données pilotées", tags: ["Qualité suivie", "Échanges structurés"],
        steps: ["Partager des données avec vos partenaires (BIM, EDI, API).", "Ouvrir des cas prédictifs.", "Contribuer aux communs de données de la filière."] },
    ],
  },
  {
    code: "cadre",
    label: "Cadre et équipe",
    court: "Cadre",
    question: "Comment l'IA est-elle encadrée chez vous ?",
    levels: [
      { n: 1, titre: "Le sujet n'est pas abordé", tags: ["Pas de règle"],
        steps: ["En parler en réunion d'équipe.", "Poser trois règles simples : relire, anonymiser, citer.", "Désigner une personne curieuse du sujet."] },
      { n: 2, titre: "Des initiatives individuelles", tags: ["Pas de cadre commun"],
        steps: ["Désigner un référent IA.", "Lister les usages déjà présents.", "Choisir un outil commun plutôt que des comptes personnels."] },
      { n: 3, titre: "Un référent et des règles simples", tags: ["Référent", "Règles d'usage"],
        steps: ["Écrire une charte IA d'une page.", "Former l'équipe aux bons réflexes.", "Prévoir un budget de test sur 3 mois."] },
      { n: 4, titre: "Une démarche structurée", tags: ["Charte", "Formation", "Budget"],
        steps: ["Piloter 1 ou 2 cas avec une mesure de départ.", "Clarifier les responsabilités : qui valide, qui signe.", "Anticiper l'AI Act."] },
      { n: 5, titre: "Une gouvernance installée", tags: ["Indicateurs", "Conformité"],
        steps: ["Revoir le portefeuille de cas chaque trimestre.", "Maintenir les compétences dans la durée.", "Partager vos pratiques avec le réseau."] },
    ],
  },
];

// Question éclair par défaut : la même que sur le passeport de l'atelier IBC du 25/09, pour comparer.
export const PULSE_DEFAULT = "Je vois clairement comment l'IA pourrait créer de la valeur dans mon métier.";

/* ---------- Cas d'usage ---------- */

export const TYPES = {
  ia: { label: "IA", description: "Lire, rédiger, résumer, contrôler ou chercher dans des documents" },
  automatisation: { label: "Automatisation", description: "Une règle, un tri ou un flux suffit ; l'IA est absente ou accessoire" },
  donnees: { label: "Données", description: "Il faut d'abord structurer, consolider ou visualiser des données" },
};

// `fonctions` : la famille s'ouvre en premier pour ces fonctions (on réordonne, on ne masque rien).
export const FAMILLES = {
  ao: { label: "Appels d'offres et consultation", icon: "search", fonctions: ["commerce", "direction"] },
  redaction: { label: "Rédaction et pièces écrites", icon: "pen", fonctions: ["be_technique", "commerce"] },
  calcul: { label: "Calcul, plans et contrôle", icon: "ruler", fonctions: ["be_technique"] },
  savoir: { label: "Veille et savoir-faire", icon: "book", fonctions: ["be_technique", "direction"] },
  gestion: { label: "Gestion et pilotage", icon: "gauge", fonctions: ["direction", "admin"] },
  etude: { label: "Étude et préparation", icon: "ruler", fonctions: ["be_technique", "production"] },
  chantier: { label: "Achats et chantier", icon: "truck", fonctions: ["production", "admin"] },
  reception: { label: "Réception et traçabilité", icon: "log", fonctions: ["production", "admin"] },
  production: { label: "Production et qualité", icon: "gear", fonctions: ["production", "direction"] },
  commercial: { label: "Commercial et logistique", icon: "truck", fonctions: ["commerce", "admin"] },
  demande: { label: "Demande et chiffrage", icon: "search", fonctions: ["commerce", "direction"] },
  fabrication: { label: "Étude et fabrication", icon: "gear", fonctions: ["be_technique", "production"] },
  ecrits: { label: "Écrits et documents", icon: "pen", fonctions: ["be_technique", "admin"] },
  admin: { label: "Administratif et mails", icon: "mail", fonctions: ["admin", "direction"] },
  pilotage: { label: "Pilotage et capitalisation", icon: "gauge", fonctions: ["direction"] },
  tous: { label: "Tous métiers", icon: "grid", fonctions: [] },
};

const TOUS = { famille: "tous", cases: ["SKILL_TRV_TRI_MAILS", "SKILL_TRV_TABLEAU_BORD", "SKILL_TRV_MODE_OPERATOIRE"] };

// `court` : la sélection de la version courte (8 à 10 cas, sans accordéon).
export const CATALOGUES = {
  bureau_etudes: {
    label: "Bureau d'études",
    familles: [
      { famille: "ao", cases: ["SKILL_TRV_LIRE_DCE", "SKILL_TRV_VEILLE_AO", "SKILL_MEN_ANALYSE_DEMANDE", "SKILL_TRV_DEVIS_RDV"] },
      { famille: "redaction", cases: ["SKILL_BET_CCTP_BLOCS", "SKILL_TRV_PIECES_ECRITES", "SKILL_MEN_CR_CHANTIER"] },
      { famille: "calcul", cases: ["SKILL_BET_COHERENCE_NOTE_CALCUL", "SKILL_MEN_EXTRACT_PLAN", "NEW_BIM_CONTROLE", "NEW_METRE_PLANS"] },
      { famille: "savoir", cases: ["SKILL_BET_VEILLE_NORMATIVE", "SKILL_TRV_PROJETS_SIMILAIRES", "SKILL_TRV_MODE_OPERATOIRE"] },
      { famille: "gestion", cases: ["SKILL_TRV_TRI_MAILS", "SKILL_TRV_TABLEAU_BORD"] },
    ],
    court: ["SKILL_TRV_LIRE_DCE", "SKILL_TRV_VEILLE_AO", "SKILL_BET_CCTP_BLOCS", "SKILL_TRV_PIECES_ECRITES",
      "SKILL_BET_COHERENCE_NOTE_CALCUL", "SKILL_BET_VEILLE_NORMATIVE", "SKILL_TRV_PROJETS_SIMILAIRES", "SKILL_TRV_TRI_MAILS"],
  },
  construction_bois: {
    label: "Construction bois",
    familles: [
      { famille: "ao", cases: ["SKILL_TRV_LIRE_DCE", "SKILL_TRV_VEILLE_AO", "SKILL_TRV_DEVIS_RDV", "SKILL_MEN_ANALYSE_DEMANDE"] },
      { famille: "etude", cases: ["SKILL_MEN_EXTRACT_PLAN", "NEW_METRE_PLANS", "SKILL_TRV_PROJETS_SIMILAIRES", "SKILL_TRV_FICHE_PRODUCTION"] },
      { famille: "chantier", cases: ["SKILL_TRV_CONTROLE_ARC", "SKILL_MEN_CR_CHANTIER", "SKILL_TRV_PIECES_ECRITES", "SKILL_FACTURE"] },
      TOUS,
    ],
    court: ["SKILL_TRV_LIRE_DCE", "SKILL_TRV_DEVIS_RDV", "SKILL_MEN_EXTRACT_PLAN", "SKILL_TRV_PROJETS_SIMILAIRES",
      "SKILL_TRV_CONTROLE_ARC", "SKILL_MEN_CR_CHANTIER", "SKILL_TRV_TRI_MAILS", "SKILL_TRV_TABLEAU_BORD"],
  },
  scierie: {
    label: "Scierie",
    familles: [
      { famille: "reception", cases: ["SKILL_BL_GRUMES", "SKILL_CERTIF_EXTRACT", "SKILL_CREATE_LOT", "SKILL_RAPPORT_TRACA"] },
      { famille: "production", cases: ["SKILL_CLASSEMENT_QUALITE", "SKILL_SCI_PLAN_SCIAGE", "SKILL_SCI_SECHAGE", "SKILL_ANOMALIE_VOLUME", "SKILL_VALORISER_CONNEXES", "SKILL_ORDO_PRODUCTION"] },
      { famille: "commercial", cases: ["SKILL_CLASSER_DEMANDES", "SKILL_COHERENCE_CMD_LIV", "SKILL_SYNTHESE_STOCK", "SKILL_TOURNEE_LIVRAISON", "SKILL_FACTURE"] },
      TOUS,
    ],
    court: ["SKILL_BL_GRUMES", "SKILL_CERTIF_EXTRACT", "SKILL_CLASSEMENT_QUALITE", "SKILL_ANOMALIE_VOLUME",
      "SKILL_CLASSER_DEMANDES", "SKILL_SYNTHESE_STOCK", "SKILL_FACTURE", "SKILL_TRV_TRI_MAILS"],
  },
  menuiserie: {
    label: "Menuiserie",
    familles: [
      { famille: "demande", cases: ["SKILL_MEN_ANALYSE_DEMANDE", "SKILL_MEN_CLASSER", "SKILL_MEN_DEVIS", "SKILL_TRV_DEVIS_RDV"] },
      { famille: "fabrication", cases: ["SKILL_MEN_EXTRACT_PLAN", "SKILL_MEN_METRE", "SKILL_MEN_NOMENCLATURE", "SKILL_TRV_FICHE_PRODUCTION"] },
      { famille: "chantier", cases: ["SKILL_MEN_RELANCE", "SKILL_TRV_CONTROLE_ARC", "SKILL_MEN_CR_CHANTIER", "SKILL_FACTURE"] },
      TOUS,
    ],
    court: ["SKILL_MEN_ANALYSE_DEMANDE", "SKILL_MEN_DEVIS", "SKILL_MEN_EXTRACT_PLAN", "SKILL_MEN_NOMENCLATURE",
      "SKILL_MEN_CR_CHANTIER", "SKILL_TRV_CONTROLE_ARC", "SKILL_TRV_TRI_MAILS", "SKILL_TRV_TABLEAU_BORD"],
  },
  transversal: {
    label: "Tous maillons",
    familles: [
      { famille: "ecrits", cases: ["SKILL_TRV_PIECES_ECRITES", "SKILL_TRV_MODE_OPERATOIRE"] },
      { famille: "ao", cases: ["SKILL_TRV_LIRE_DCE", "SKILL_TRV_VEILLE_AO", "SKILL_TRV_DEVIS_RDV"] },
      { famille: "admin", cases: ["SKILL_TRV_TRI_MAILS", "SKILL_TRV_CONTROLE_ARC", "SKILL_FACTURE"] },
      { famille: "pilotage", cases: ["SKILL_TRV_TABLEAU_BORD", "SKILL_TRV_PROJETS_SIMILAIRES"] },
    ],
    court: ["SKILL_TRV_PIECES_ECRITES", "SKILL_TRV_MODE_OPERATOIRE", "SKILL_TRV_LIRE_DCE", "SKILL_TRV_VEILLE_AO", "SKILL_TRV_DEVIS_RDV",
      "SKILL_TRV_TRI_MAILS", "SKILL_TRV_CONTROLE_ARC", "SKILL_FACTURE", "SKILL_TRV_TABLEAU_BORD", "SKILL_TRV_PROJETS_SIMILAIRES"],
  },
};

/**
 * Surcouche par cas. `label` : libellé mobile (80 caractères au plus). `type` : ia | automatisation | donnees.
 * `corpus` : le cas exige un corpus (normes, bibliothèque, archives) ; son effort monte quand les données sont faibles.
 * `note_tpe` : remarque affichée aux structures de 1 à 5 personnes. Les cas « NEW_ » n'existent pas encore dans la
 * Processothèque : ils portent ici leur texte et un effort estimé.
 */
export const CASES = {
  SKILL_TRV_LIRE_DCE: { label: "Lire un dossier de consultation et en tirer une fiche d'une page", type: "ia",
    vigilance: "Vérifier à la main les dates limites et les pièces à fournir." },
  SKILL_TRV_VEILLE_AO: { label: "Trier les avis d'appels d'offres selon votre profil", type: "automatisation",
    vigilance: "Relire chaque semaine les avis écartés pour ajuster le ciblage." },
  SKILL_MEN_ANALYSE_DEMANDE: { label: "Analyser une demande client (mail, CCTP, DPGF, plans)", type: "ia",
    vigilance: "Chaque exigence renvoie à sa source ; rien n'est deviné." },
  SKILL_TRV_DEVIS_RDV: { label: "Préparer une proposition depuis les notes de rendez-vous", type: "ia",
    vigilance: "Les prix restent à compléter par le chargé d'affaires." },
  SKILL_BET_CCTP_BLOCS: { label: "Rédiger un CCTP depuis votre bibliothèque de paragraphes", type: "ia", corpus: true,
    vigilance: "Chaque bloc garde sa source ; l'ingénieur relit et signe." },
  SKILL_TRV_PIECES_ECRITES: { label: "Rédiger une note, un rapport ou un compte rendu depuis un modèle maison", type: "ia",
    vigilance: "Relecture obligatoire avant diffusion." },
  SKILL_MEN_CR_CHANTIER: { label: "Rédiger un compte rendu de chantier depuis notes, dictée et photos", type: "ia",
    vigilance: "Les réserves sont relues avant diffusion." },
  SKILL_BET_COHERENCE_NOTE_CALCUL: { label: "Contrôler la cohérence d'une note de calcul", type: "ia",
    vigilance: "Ne recalcule rien : l'ingénieur reste seul à valider et signer." },
  SKILL_MEN_EXTRACT_PLAN: { label: "Extraire cotes et exigences d'un plan PDF", type: "ia",
    vigilance: "Contrôle humain des dimensions critiques avant fabrication." },
  NEW_BIM_CONTROLE: { label: "Contrôler une maquette BIM ou un plan CAO", type: "ia", effort: 4, statut: "a_creer",
    description: "Vérifie la cohérence d'une maquette ou d'un jeu de plans (éléments manquants, repères incohérents, écarts avec la nomenclature) et liste les points à reprendre.",
    donnees: "Maquette IFC ou plans exportés, règles de contrôle du bureau, nomenclature des éléments.",
    vigilance: "Cas à créer : à cadrer avec un bureau pilote.",
    note_tpe: "Suppose une chaîne BIM déjà en place." },
  NEW_METRE_PLANS: { label: "Établir un métré depuis les plans ou la maquette", type: "donnees", effort: 3, statut: "a_creer",
    description: "Calcule les quantités (sections, longueurs, volumes, surfaces de panneaux) à partir des plans ou de la maquette, pour le chiffrage et la commande matière.",
    donnees: "Plans vectoriels ou maquette, conventions de métré du bureau, bibliothèque de sections.",
    vigilance: "Cas à créer : les quantités sont contrôlées avant chiffrage." },
  SKILL_BET_VEILLE_NORMATIVE: { label: "Interroger vos normes et DTU, avec citation des sources", type: "ia", corpus: true,
    vigilance: "Réponse « hors corpus » plutôt qu'improvisée ; corpus tenu à jour." },
  SKILL_TRV_PROJETS_SIMILAIRES: { label: "Retrouver les projets similaires dans vos archives", type: "ia", corpus: true,
    vigilance: "Un projet proche n'est pas identique : prix historiques datés." },
  SKILL_TRV_MODE_OPERATOIRE: { label: "Écrire un mode opératoire depuis une explication orale", type: "ia",
    vigilance: "Validé par l'expert et le responsable sécurité avant diffusion." },
  SKILL_TRV_TRI_MAILS: { label: "Trier les mails par affaire et préparer les réponses", type: "automatisation",
    vigilance: "Aucun envoi automatique ; accès limité aux boîtes utiles." },
  SKILL_TRV_TABLEAU_BORD: { label: "Produire un tableau de bord hebdomadaire depuis vos exports", type: "donnees",
    vigilance: "Formules testées une première fois sur un mois connu.",
    note_tpe: "En très petite structure, un tableur partagé bien tenu suffit souvent : commencez par là." },
  SKILL_TRV_FICHE_PRODUCTION: { label: "Établir la fiche de production depuis le devis accepté", type: "ia",
    vigilance: "Vérifier d'abord que votre logiciel ne le fait pas déjà." },
  SKILL_TRV_CONTROLE_ARC: { label: "Contrôler un accusé de réception de commande fournisseur", type: "automatisation",
    vigilance: "Écarts validés par l'acheteur, aucune réclamation automatique." },
  SKILL_FACTURE: { label: "Préparer une facture depuis la commande et la livraison", type: "automatisation",
    vigilance: "Validation avant émission ; la numérotation reste dans l'outil comptable." },
  SKILL_BL_GRUMES: { label: "Lire un bon de livraison grumes", type: "ia",
    vigilance: "Volumes et essences contrôlés avant l'entrée en stock." },
  SKILL_CERTIF_EXTRACT: { label: "Extraire les données d'un certificat PEFC ou FSC", type: "ia",
    vigilance: "Validité vérifiée sur la base officielle du certificateur." },
  SKILL_CREATE_LOT: { label: "Créer automatiquement un lot bois", type: "automatisation",
    vigilance: "Numérotation et rattachement contrôlés à la réception." },
  SKILL_RAPPORT_TRACA: { label: "Préparer un rapport de traçabilité par lot", type: "donnees",
    vigilance: "Données sources vérifiées avant transmission au client." },
  SKILL_CLASSEMENT_QUALITE: { label: "Assister le classement qualité du bois", type: "ia",
    vigilance: "Le classeur valide ; la classe proposée reste une aide." },
  SKILL_SCI_PLAN_SCIAGE: { label: "Optimiser le plan de débit", type: "donnees",
    vigilance: "Plan validé par le scieur avant lancement." },
  SKILL_SCI_SECHAGE: { label: "Recommander un programme de séchage", type: "donnees",
    vigilance: "Paliers contrôlés par le responsable séchoir." },
  SKILL_ANOMALIE_VOLUME: { label: "Détecter les anomalies de volume", type: "donnees",
    vigilance: "Une alerte se vérifie ; elle ne corrige rien seule." },
  SKILL_VALORISER_CONNEXES: { label: "Valoriser les connexes de scierie", type: "donnees",
    vigilance: "Orientation validée selon les débouchés réels." },
  SKILL_ORDO_PRODUCTION: { label: "Aider à l'ordonnancement de production", type: "donnees",
    vigilance: "Le planning proposé est arbitré par le chef d'atelier.",
    note_tpe: "Utile au-delà de quelques postes ; en très petite structure, un planning partagé suffit." },
  SKILL_CLASSER_DEMANDES: { label: "Classer les demandes clients entrantes", type: "ia",
    vigilance: "Les demandes ambiguës restent à trier à la main." },
  SKILL_COHERENCE_CMD_LIV: { label: "Contrôler la cohérence entre commande et livraison", type: "automatisation",
    vigilance: "Les écarts sont tranchés par une personne avant facturation." },
  SKILL_SYNTHESE_STOCK: { label: "Générer une synthèse de stock", type: "donnees",
    vigilance: "Stock physique rapproché régulièrement de la synthèse." },
  SKILL_TOURNEE_LIVRAISON: { label: "Planifier une tournée de livraison", type: "donnees",
    vigilance: "Le chauffeur garde la main sur les contraintes du terrain.",
    note_tpe: "Avec un ou deux véhicules, un planning partagé suffit souvent." },
  SKILL_MEN_CLASSER: { label: "Qualifier une demande de menuiserie", type: "ia",
    vigilance: "Les demandes hors périmètre sont signalées, pas écartées." },
  SKILL_MEN_DEVIS: { label: "Générer une trame de devis menuiserie", type: "ia",
    vigilance: "Postes et quantités relus ; prix laissés vides." },
  SKILL_MEN_METRE: { label: "Assister le métré et le quantitatif", type: "donnees",
    vigilance: "Les cotes relevées sur site priment toujours." },
  SKILL_MEN_NOMENCLATURE: { label: "Générer une nomenclature et une liste de débit", type: "ia",
    vigilance: "Liste contrôlée avant lancement en fabrication." },
  SKILL_MEN_RELANCE: { label: "Préparer une relance fournisseur", type: "automatisation",
    vigilance: "Relance relue avant envoi." },
};

/* ---------- Règles de calcul ---------- */

export const QUADRANTS = [
  { code: "tester", label: "À tester tout de suite", description: "Bénéfice fort, effort faible : un premier essai tient en quelques jours." },
  { code: "cadrer", label: "À cadrer", description: "Bénéfice fort, effort réel : à préparer avec une mesure de départ." },
  { code: "appoint", label: "Gains d'appoint", description: "Simples à mettre en place, bénéfice modéré." },
  { code: "plus_tard", label: "Plus tard", description: "Effort réel pour un bénéfice modéré : à revoir plus tard." },
];

export const REGLES = {
  priorite_forte: 4,       // priorité >= 4 : bénéfice fort
  effort_faible: 2,        // effort <= 2 : effort faible
  priorite_defaut: 3,      // un cas sans note compte pour 3
  ajustement_donnees: 2,   // niveau Données <= 2 : +1 d'effort pour les cas Données ou à corpus
  seuil_agregats: 3,       // la vue salle n'affiche rien sous 3 réponses
};

/* ---------- Suites proposées ---------- */

// Évaluées dans l'ordre ; on affiche au plus 2 offres, puis les ressources et le rendez-vous.
export const OFFRES = [
  { code: "deployer", titre: "Déployer : assistance technique",
    texte: "Outiller et piloter vos cas d'usage dans la durée, avec une charte IA et un tableau de bord.",
    si: { min: { ia: 4, cadre: 4 } } },
  { code: "accompagnement", titre: "Accompagnement cas d'usage",
    texte: "De la mesure de départ à la solution en production, en 2 à 6 semaines, sur le cas « {cadrer} ».",
    si: { quadrant: "cadrer", min: { cadre: 3 } } },
  { code: "atelier", titre: "Atelier découverte",
    texte: "Une journée pour repartir avec un premier outil IA fonctionnel sur le cas « {tester} ».",
    si: { quadrant: "tester" } },
];

export const OFFRE_DEFAUT = { code: "atelier", titre: "Atelier découverte",
  texte: "Une journée pour identifier vos cas d'usage et repartir avec un premier outil IA fonctionnel." };

export const RESSOURCES = [
  { code: "mooc", titre: "Académie PerfIA, niveau 1", texte: "Le MOOC gratuit pour prendre les bons réflexes avec l'IA générative.",
    url: "https://mooc-ia.kosm.io", si: { max: { ia: 2 } } },
  { code: "data", titre: "Webinaire « Pas d'IA sans DATA »", texte: "Les 5 gestes data : inventorier, ranger, structurer, protéger, écrire.",
    url: "https://ia-automatisation.kosm.io", si: { max: { donnees: 2 } } },
];

export const VIGILANCES = [
  { si: { type: "ia" }, texte: "L'IA propose, vous décidez : chaque résultat se relit et se vérifie avant usage." },
  { si: { catalogue: ["bureau_etudes", "construction_bois"] }, texte: "L'ingénieur reste responsable de ce qu'il signe : l'IA prépare, elle ne valide pas." },
  { si: { cas: true }, texte: "Anonymisez les documents clients (X1, X2…) tant que l'outil n'est pas maîtrisé par l'entreprise." },
  { si: { corpus: true }, texte: "Un corpus à jour et cité (normes, modèles, archives) conditionne la qualité des réponses." },
  { si: { max: { cadre: 2 } }, texte: "Posez trois règles simples avant de généraliser : relire, anonymiser, citer." },
];
