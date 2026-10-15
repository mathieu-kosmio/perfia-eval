# PerfIA Eval : spécification

Diagnostic de maturité IA sur mobile pour la filière forêt-bois (PerfIA, Kosmio × Xylofutur).

| | |
|---|---|
| Statut | v0.2 : lot 1 développé (application 0.1.0, 15/10/2026), décisions encore ouvertes au §15 |
| Date | 2026-10-15 |
| Auteur | Mathieu Pesin (Kosmio), rédigé avec Claude |
| Dépôt | `mathieu-kosmio/perfia-eval` |

---

## 0. En une page

**Le besoin.** Pendant une intervention (atelier, visio, table ronde, salon), chaque participant fait sur son
téléphone un diagnostic de maturité IA en 3 à 7 minutes. Il repart avec une feuille de route personnelle. Kosmio
repart avec un prospect qualifié : identité, maillon, maturité, cas d'usage prioritaires, consentement. Hors
intervention, le même outil sert de porte d'entrée permanente à l'offre PerfIA pour les acteurs de la filière.

**Le parcours** reprend celui du design de référence, en 5 étapes : *Vous*, *Maturité*, *Cas d'usage*, *Priorité*,
*Feuille de route*. Il se spécialise sur la filière bois de trois façons :

- les cas d'usage proposés viennent de la Processothèque PerfIA et dépendent du maillon déclaré (bureau d'études,
  scierie, menuiserie, etc.) ;
- les niveaux de maturité parlent le langage de la filière ;
- la feuille de route mène à l'offre PerfIA (atelier découverte, accompagnement, déploiement), sans gain chiffré
  non mesuré.

**Ce qui le distingue d'un formulaire** : une *session* par intervention (QR code et lien court), une *vue salle* qui
affiche en direct les résultats agrégés et anonymes du public, comparés aux mesures des ateliers précédents, et un
rapport imprimable en PDF.

**Le socle technique** : oui, on repart du squelette `Kosmio/skeleton-pocketbase` (Skellyto), allégé. On garde
PocketBase, la page HTML sans build, les hooks, la sécurité, le relais Brevo, le MCP et le déploiement Coolify. On
retire le multi-organisation, les votes, les commentaires, la progression, les équipes et l'IA vocale. Voir §10.

**Pour demain (16/10)**, deux options sont décrites au §14 : une version express ce soir sur le site public existant,
ou un lien différé envoyé avec le replay.

---

## 1. Contexte

### 1.1 Ce qui existe déjà

| Brique | Où | Ce qu'on en reprend |
|---|---|---|
| Auto-diagnostic IA filière bois v2 (Certifiko) | `04_Execution/Methodologie/DWC_Autodiagnostic_IA-Automatisation-Filiere-Bois_v2.jsonld` | Les dimensions données, capacité de déploiement et IA responsable, pour décrire les niveaux. Trop long pour le mobile : 35 questions. |
| Passeport participant IBC | `04_Execution/Atelier/Atelier IBC/` | L'échelle d'usage de l'IA sur 5 et la question de clarté de la valeur, pour comparer avec la mesure du 25/09 |
| Fiche atelier BET | `05_Webinaire/Atelier-BET-45min/` | Les niveaux Nul, Chat, Agents partagés, Harnais ; les 6 usages BET ; le bénéfice attendu |
| Widget autodiag du MOOC | `13_mooc_PerfIa/Kosmooc/web/src/widgets/autodiag.js` | Le format 2 minutes, la jauge, les profils |
| Consolidation des ateliers 2026 | `06_RETEX/2026-09-26-consolidation-ateliers-ia.md` | 8 familles de besoins, priorisation « à tester tout de suite » / « à cadrer » |
| Processothèque | `perfia-processotheque/` (Supabase) | Catalogue des cas d'usage (`ai_skills`), maillons (`ref_actor_types`), complexité |
| Offre PerfIA v3 | `00_Pilotage/Offre PerfIA - v3 simplifiée et pilotes filière.md` | Les 3 niveaux d'offre et la règle « jamais de gain chiffré non mesuré » |
| Site public | dépôt `mathieu-kosmio/ia-automatisation`, `server.js` | La route `POST /api/lead` vers Brevo, le précédent `choix-ia.html` |
| Charte PerfIA | `design-system/`, `01_Charte-Graphique/` | Couleurs, typographies, co-branding Kosmio × Xylofutur |

### 1.2 Ce que le terrain nous a appris

- **Le papier perd des contacts.** À La Rochelle, il manquait 7 adresses sur 14 pour envoyer la synthèse, et les
  adresses manuscrites sont à vérifier. Saisir une restitution prend 2 à 3 minutes par canevas, soit 30 à
  40 minutes pour 12 participants.
- **La friction tue la complétion.** Un lien de validation par e-mail qui expire a cassé le parcours Certifiko. Ici,
  on ne crée **aucun compte** côté participant.
- **Il existe des mesures de départ.** À l'atelier IBC du 25/09 (27 participants), l'usage de l'IA était de 2,1/5 et
  la clarté de la valeur perçue allait de 1,9 à 2,5 selon les tables. Reprendre les mêmes échelles permet de
  comparer.
- **Les gains rapides convergent** : lecture de DCE et d'AO, rédaction depuis les modèles maison, tri des mails, veille
  normative citée. Le calcul et la 3D relèvent de projets à cadrer.
- **La responsabilité reste à l'ingénieur.** Confidentialité des plans, fiabilité des sources normatives et
  signature de l'ingénieur doivent apparaître dans la restitution.

---

## 2. Objectifs et indicateurs

| Objectif | Indicateur | Cible V1 |
|---|---|---|
| Faire passer le diagnostic en séance | Taux de complétion parmi ceux qui ouvrent le lien | ≥ 70 % |
| Rester court | Durée médiane, version courte / version complète | ≤ 3 min / ≤ 7 min |
| Collecter des prospects exploitables | Part des diagnostics avec e-mail valide et consentement de recontact | ≥ 50 % |
| Alimenter le pipe PerfIA | Prospects transmis au pipe Notion sous 48 h après la session | 100 % |
| Servir de porte d'entrée filière | Diagnostics hors session par mois (lien sur les sites Xylofutur et PerfIA) | à mesurer |
| Convertir | Rendez-vous pris depuis la feuille de route | à mesurer |

---

## 3. Utilisateurs et situations

| Qui | Situation | Ce qu'il attend |
|---|---|---|
| **Participant** : dirigeant, ingénieur, chargé d'affaires, dessinateur ou assistant d'un BE, d'une scierie, d'une menuiserie… | Scanne un QR code en salle ou clique un lien dans le chat d'une visio | Se situer vite, repartir avec des cas concrets pour son métier, garder un PDF |
| **Visiteur web** | Arrive depuis le site PerfIA, Xylofutur, un e-mail ou le MOOC | Idem, sans animateur ; peut prendre rendez-vous |
| **Animateur** (Mathieu) | Prépare la session, projette la vue salle, rebondit sur les résultats | Créer une session en 2 minutes, voir le public en direct, récupérer les prospects |
| **Équipe Kosmio** | Après la session | Exporter, qualifier, relancer, alimenter Notion |
| **Organisateur partenaire** (IBC, Xylofutur, FIBOIS) | Avant et après | Recevoir la synthèse agrégée et, avec consentement, les contacts de ses membres |

---

## 4. Parcours participant

### 4.1 Entrée

- **Lien de session** : `https://<domaine>/s/<code>`, par exemple `/s/ibc`, avec un QR code généré pour la projection.
  La session pré-règle le maillon par défaut, la version (courte ou complète), le logo de l'organisateur, le libellé
  du consentement partenaire et la mesure de référence pour la vue salle.
- **Lien générique** : `https://<domaine>/`, sans session. Version complète ; le maillon est demandé.
- **Accueil** : le titre (« Votre feuille de route IA en 5 minutes »), les logos Kosmio ✕ Xylofutur (et
  l'organisateur), la durée annoncée, la mention « aucun compte à créer » et le bouton *Commencer*.
- **Reprise** : la progression est gardée dans le navigateur (`localStorage`, protégé par `try/catch`). Un participant
  qui ferme l'onglet reprend où il en était.

### 4.2 Étape 1 : Vous

Titre : « Faisons connaissance ». Sous-titre : « Quelques informations pour personnaliser votre feuille de route ».

| Champ | Version complète | Version courte | Remarque |
|---|---|---|---|
| Prénom | requis | requis | |
| Nom | requis | facultatif | |
| Entreprise | requis | requis | |
| Fonction | requis, liste | facultatif | Direction · BE et technique · Commerce et chiffrage · Administratif et finance · Production, atelier ou chantier · Autre |
| E-mail professionnel | requis | requis | Sert à l'envoi du rapport. Vérification de format seulement, pas de lien de validation. |
| Maillon | requis, liste | pré-réglé par la session, modifiable | Voir §6.1. Détermine le catalogue de cas d'usage. |
| Effectif | requis, liste | facultatif | 1-5 · 6-20 · 21-50 · 51-250 · plus de 250 |
| Téléphone | facultatif | absent | |

Consentements, sous les champs, jamais pré-cochés :

1. *Requis* : « J'accepte que Kosmio traite ces informations pour établir et m'envoyer ma feuille de route. »
2. *Facultatif* : « J'accepte d'être recontacté par Kosmio au sujet de l'accompagnement PerfIA. »
3. *Facultatif, seulement si la session le prévoit* : « J'accepte que mes réponses soient transmises à
   [organisateur]. »
4. *Facultatif* : « Je souhaite recevoir les invitations aux webinaires et ateliers PerfIA. »

Un lien « Comment sont utilisées mes données » ouvre la notice (§12).

**Option de session** : l'identité peut passer en dernière étape, juste avant la feuille de route (« pour recevoir
votre rapport »). C'est recommandé pour le lien générique ; en salle, on garde l'ordre du design de référence.

### 4.3 Étape 2 : Maturité

Titre : « Où en êtes-vous ? ». Sous-titre : « Choisissez le niveau qui vous ressemble pour chaque axe ».

**Mise en œuvre (15/10/2026) : un axe par écran.** Un repère « Axe 1 sur 3 », la question de l'axe en titre, puis les
5 niveaux empilés (illustration, nom, numéro, une phrase). Un toucher sélectionne le niveau et passe à l'axe suivant ;
*Précédent* revient en arrière. La première version (cartes repliables avec carrousel horizontal) a été abandonnée :
sur téléphone, on ne voyait qu'un niveau sur cinq.

Une question éclair, réglable par session, forme un quatrième écran, facultatif. Par défaut : « Je vois clairement comment l'IA
pourrait créer de la valeur dans mon métier » (1 à 5). C'est la même question que sur le passeport IBC, pour comparer
avec le 25/09.

### 4.4 Étape 3 : Cas d'usage

Titre : « Quels cas d'usage vous parlent ? ». Sous-titre : « Cochez ceux que vous utilisez déjà ou que vous
aimeriez mettre en place ».

- Un compteur en tête : « 3 cas sélectionnés ».
- Des familles en accordéon (icône, nom, « 0 / 4 sélectionné »). La famille la plus pertinente pour le maillon est
  ouverte par défaut.
- Chaque cas : une case et un libellé court. Un toucher sur le cas ouvre un sous-choix, *Je l'utilise déjà* ou
  *Je voudrais*. Par défaut, c'est *Je voudrais*. Les cas *déjà utilisés* ne vont pas à l'étape Priorité ; ils
  apparaissent dans le rapport comme acquis.
- Un lien « Voir le détail » sous chaque cas : description d'une ligne, données nécessaires, point de vigilance.
- Version courte : 8 à 10 cas, sans accordéon. Version complète : 15 à 20 cas en 4 à 6 familles.
- Champ facultatif en bas : « Une tâche qui vous coûte du temps et qui n'est pas dans la liste ? » (texte libre,
  280 caractères).
- *Suivant* est actif dès 1 cas *Je voudrais*. Si aucun, on propose de passer directement à la feuille de route.

### 4.5 Étape 4 : Priorité

Titre : « Priorisez vos cas d'usage ». Sous-titre : « De 1 (faible) à 5 (fort), selon le bénéfice que vous en
attendez ».

Une carte par cas *Je voudrais*, avec 5 étoiles. Il s'agit d'un groupe de boutons radio accessible au clavier et au
lecteur d'écran (« 3 sur 5 »). Un tiret indique l'absence de note. Un cas sans note compte pour 3 dans le calcul.

### 4.6 Étape 5 : Feuille de route

Trois écrans qui défilent, comme dans le design de référence :

1. **Vos prochaines étapes.** Une carte par axe : illustration du niveau, nom de l'axe et 3 étapes numérotées
   adaptées au niveau déclaré (§6.2).
2. **Analyse de vos cas d'usage.** Les cas sont regroupés par type (*IA*, *Automatisation*, *Données*, §6.3). Chaque
   ligne montre le libellé et une jauge d'effort de 1 à 5, avec sa valeur en texte. Le tri va du plus simple au plus
   exigeant.
3. **Matrice de priorisation.** L'effort est en abscisse, la priorité en ordonnée, de 1 à 5 sur les deux axes. Une
   bulle par position, colorée par type, avec le nombre de cas qu'elle regroupe. Une légende numérotée suit, par
   exemple « 1. Lire un DCE · E2/P5 ». Les quadrants portent les mots des ateliers : *À tester tout de suite*,
   *À cadrer*, *Gains d'appoint*, *Plus tard*. La matrice s'agrandit en plein écran.

Le bouton *Terminer : voir ma feuille de route* enregistre le diagnostic (§9) et ouvre l'écran de fin.

### 4.7 Écran de fin

- « Merci [Prénom] ! Votre feuille de route est prête. »
- *Visualiser mon rapport* : vue document (§5).
- *Télécharger le PDF* : impression du navigateur avec une feuille de style d'impression.
- *Recevoir par e-mail* : envoi automatique si le consentement 1 est donné ; un bouton *Renvoyer par e-mail* (3 fois
  au plus), aussi présent sur le rapport.
- Inscription à la liste Brevo des invitations pour les participants qui donnent le consentement 4
  (`APP_BREVO_LIST_ID`).
- **Ce que nous vous proposons** : 1 ou 2 recommandations d'offre (§7.4), puis *Échanger 30 minutes*, un lien de prise
  de rendez-vous.
- *Retour à l'accueil*.

---

## 5. Rapport

Une page HTML imprimable en A4 portrait, `rapport.html#<jeton>` (le jeton reste dans le fragment de l'adresse : il n'apparaît pas dans les journaux du serveur). Le jeton est aléatoire, 32 caractères, et le
lien est valable 12 mois. Le rapport ne s'indexe pas (`noindex`).

1. En-tête : logos Kosmio ✕ Xylofutur (et l'organisateur), « Feuille de route IA », date, nom de la session.
2. Informations du participant : prénom, nom, entreprise, fonction, maillon.
3. Vos prochaines étapes : les 3 axes, le niveau et les 3 étapes de chacun.
4. Analyse de vos cas d'usage : la matrice, la légende numérotée, puis les tableaux par type avec les jauges. Les cas
   *déjà utilisés* figurent dans une ligne « Déjà en place ».
5. Points de vigilance, selon les cas choisis : l'ingénieur reste responsable de ce qu'il signe ; anonymiser les
   documents clients (X1, X2) ; s'appuyer sur un corpus normatif à jour et cité.
6. Pour aller plus loin : recommandations d'offre, lien de rendez-vous, ressources (webinaire « Pas d'IA sans DATA »,
   MOOC Académie PerfIA niveau 1).
7. Pied de page : « Co-édité par Kosmio et Xylofutur · Dispositif opéré par Kosmio », version du référentiel,
   mentions.

Aucun gain chiffré n'apparaît, sauf présenté comme hypothèse à mesurer.

---

## 6. Contenu : le référentiel

Le référentiel (axes, niveaux, étapes, familles, cas d'usage, règles) est **un fichier JSON versionné dans le
dépôt**, pas une table de la base. Il est relu dans les revues de code, il fonctionne hors ligne, et chaque
diagnostic enregistre la version utilisée. Voir §8 pour sa fabrication.

### 6.1 Maillons

On aligne sur les 9 acteurs de la Processothèque (`ref_actor_types`), plus deux entrées.

| Code | Libellé affiché | Catalogue en V1 |
|---|---|---|
| `bureau_etudes` | Bureau d'études bois, ingénierie | oui |
| `construction_bois` | Construction bois, charpente | oui (cas BE et transversaux) |
| `scierie` | Scierie, première transformation | oui (avancé de V1.1 : cas déjà validés) |
| `menuiserie` | Menuiserie, agencement, ameublement | oui (avancé de V1.1 : cas déjà validés) |
| `exploitant_forestier` | Exploitation forestière, sylviculture | V2, après validation des cas |
| `negoce` | Négoce, distribution | V2, après validation des cas |
| `transport` | Transport, logistique bois | V2, après validation des cas |
| `panneaux` | Industrie des panneaux | V2 |
| `bois_energie` | Bois-énergie | V2 |
| `institution` | Pôle, fédération, collectivité, formation | transversal |
| `autre` | Autre ou plusieurs maillons | transversal |

Un maillon sans catalogue propre affiche les cas transversaux.

### 6.2 Axes et niveaux

Le design de référence a 2 axes. On en propose 3 : le slogan PerfIA « Pas d'IA sans DATA » justifie les deux
premiers, et les ateliers ont montré que le cadre (référent, règles, responsabilité) freine autant que la technique.
Chaque axe a 5 niveaux. Les noms reprennent les stades de croissance d'un peuplement forestier ; à valider (Q4).

| Niveau | Nom | Idée |
|---|---|---|
| 1 | Semis | On n'a pas commencé |
| 2 | Fourré | Des essais isolés |
| 3 | Gaulis | Un usage régulier, encore individuel |
| 4 | Perchis | Des pratiques partagées et outillées |
| 5 | Futaie | Intégré, piloté, durable |

**Axe IA : vos usages de l'IA.** L'échelle est la même que celle du passeport IBC, ce qui permet de comparer.

| Niveau | Description affichée | Étiquettes | Prochaines étapes |
|---|---|---|---|
| 1 | L'IA, on n'y touche pas encore | Jamais ou presque | 1. Tester un assistant sur un écrit non confidentiel. 2. Apprendre à donner du contexte et à relire. 3. Noter trois tâches répétitives de votre semaine. |
| 2 | Quelques essais, chacun de son côté | Usage ponctuel · Chat | 1. Choisir une tâche et la refaire chaque semaine avec l'IA. 2. Garder les consignes qui marchent. 3. Savoir quels documents on peut lui confier. |
| 3 | Un usage régulier au poste de travail | Hebdomadaire · Consignes réutilisées | 1. Partager les meilleures consignes dans l'équipe. 2. Passer à un assistant qui lit vos documents maison. 3. Mesurer le temps avant et après sur un cas. |
| 4 | Des assistants partagés dans l'équipe | Agents partagés · Documents maison | 1. Brancher un cas sur un vrai processus, avec validation humaine. 2. Suivre le coût par tâche réussie. 3. Réduire la dépendance à un seul fournisseur. |
| 5 | L'IA intégrée dans vos processus | Harnais · Production | 1. Industrialiser les cas qui ont fait leurs preuves. 2. Tenir un tableau de bord de 5 à 7 indicateurs. 3. Partager vos retours avec la filière. |

**Axe Données : vos données et documents.** Il s'appuie sur les blocs B et C de l'autodiag et sur les 5 gestes data.

| Niveau | Description affichée | Étiquettes | Prochaines étapes |
|---|---|---|---|
| 1 | Dans les têtes et sur papier | Papier · Mémoire | 1. Inventorier vos documents récurrents. 2. Numériser un modèle maison par type de document. 3. Choisir un espace de stockage partagé. |
| 2 | Des fichiers épars | Excel · Mails · Dossiers | 1. Ranger : une arborescence et un nommage communs. 2. Écrire vos modèles de documents. 3. Repérer les ressaisies entre logiciels. |
| 3 | Des outils métier | Logiciels métier · Serveur | 1. Structurer : exports réguliers de vos logiciels. 2. Constituer un corpus de référence (normes, modèles, projets). 3. Protéger : savoir ce qui est confidentiel. |
| 4 | Des données consolidées | Historique fiable · Tableaux de bord | 1. Rendre le corpus exploitable par l'IA, avec ses sources. 2. Suivre la qualité des données clés. 3. Relier vos outils plutôt que ressaisir. |
| 5 | Des données pilotées | Qualité suivie · Échanges structurés | 1. Partager des données avec vos partenaires (BIM, EDI, API). 2. Ouvrir des cas prédictifs. 3. Contribuer aux communs de données de la filière. |

**Axe Cadre : votre organisation.** Il reprend les 4 piliers de la table ronde IBC : savoir-faire, usages,
gouvernance, responsabilité.

| Niveau | Description affichée | Étiquettes | Prochaines étapes |
|---|---|---|---|
| 1 | Le sujet n'est pas abordé | Pas de règle | 1. En parler en réunion d'équipe. 2. Poser trois règles simples : relire, anonymiser, citer. 3. Désigner une personne curieuse du sujet. |
| 2 | Des initiatives individuelles | Pas de cadre commun | 1. Désigner un référent IA. 2. Lister les usages déjà présents. 3. Choisir un outil commun plutôt que des comptes personnels. |
| 3 | Un référent et des règles simples | Référent · Règles d'usage | 1. Écrire une charte IA d'une page. 2. Former l'équipe aux bons réflexes. 3. Prévoir un budget de test sur 3 mois. |
| 4 | Une démarche structurée | Charte · Formation · Budget | 1. Piloter 1 ou 2 cas avec une mesure de départ. 2. Clarifier les responsabilités (qui valide, qui signe). 3. Anticiper l'AI Act. |
| 5 | Une gouvernance installée | Indicateurs · Conformité | 1. Revoir le portefeuille de cas chaque trimestre. 2. Maintenir les compétences dans la durée. 3. Partager vos pratiques avec le réseau. |

Les illustrations sont à produire : 5 visuels de peuplement, un par niveau, en trait sur fond sombre. On ne reprend
aucun visuel du design de référence.

### 6.3 Types de cas d'usage

Le design de référence classe les cas en *Data*, *IA* et *Automatisation*. On garde ces trois types, qui traduisent
la porte de sobriété PerfIA (« faut-il de l'IA ? ») :

| Type | Couleur | Règle de classement |
|---|---|---|
| Automatisation | or | Une règle, un tri ou un flux suffit ; l'IA est absente ou accessoire |
| Données | sauge | Il faut d'abord structurer, consolider ou visualiser des données |
| IA | vert | Lire, rédiger, résumer, contrôler ou chercher dans des documents |

Le type est posé à la main dans la couche éditoriale (§8), pas déduit de `skill_category`.

### 6.4 Catalogue V1 du profil « Bureau d'études »

Ce catalogue vient de la Processothèque et de la consolidation des ateliers 2026. L'effort est la complexité
technique de la Processothèque (`technical_complexity_score`).

| Famille | Libellé affiché | Code Processothèque | Type | Effort | Statut Processothèque |
|---|---|---|---|---|---|
| Appels d'offres et consultation | Lire un dossier de consultation et en tirer une fiche d'une page | `SKILL_TRV_LIRE_DCE` | IA | 2 | brouillon |
| | Trier les avis d'appels d'offres selon votre profil | `SKILL_TRV_VEILLE_AO` | Automatisation | 2 | brouillon |
| | Analyser une demande client (mail, CCTP, DPGF, plans) | `SKILL_MEN_ANALYSE_DEMANDE` | IA | 2 | validé |
| | Préparer une proposition depuis les notes de rendez-vous | `SKILL_TRV_DEVIS_RDV` | IA | 2 | brouillon |
| Rédaction et pièces écrites | Rédiger un CCTP depuis votre bibliothèque de paragraphes | `SKILL_BET_CCTP_BLOCS` | IA | 3 | brouillon |
| | Rédiger une note, un rapport ou un compte rendu depuis un modèle maison | `SKILL_TRV_PIECES_ECRITES` | IA | 2 | brouillon |
| | Compte rendu de visite de chantier depuis notes, dictée et photos | `SKILL_MEN_CR_CHANTIER` | IA | 2 | validé |
| Calcul, plans et contrôle | Contrôler la cohérence d'une note de calcul | `SKILL_BET_COHERENCE_NOTE_CALCUL` | IA | 4 | brouillon |
| | Extraire cotes et exigences d'un plan PDF | `SKILL_MEN_EXTRACT_PLAN` | IA | 3 | validé |
| | Contrôler une maquette BIM ou un plan CAO | à créer | IA | 4 (estimé) | absent |
| | Établir un métré depuis les plans ou la maquette | à créer | Données | 3 (estimé) | absent |
| Veille et savoir-faire | Interroger vos normes et DTU, avec citation des sources | `SKILL_BET_VEILLE_NORMATIVE` | IA | 3 | brouillon |
| | Retrouver les projets similaires dans vos archives | `SKILL_TRV_PROJETS_SIMILAIRES` | IA | 3 | brouillon |
| | Écrire un mode opératoire depuis une explication orale | `SKILL_TRV_MODE_OPERATOIRE` | IA | 2 | brouillon |
| Gestion et pilotage | Trier les mails par affaire et préparer les réponses | `SKILL_TRV_TRI_MAILS` | Automatisation | 2 | brouillon |
| | Tableau de bord hebdomadaire (affaires, temps passés) depuis vos exports | `SKILL_TRV_TABLEAU_BORD` | Données | 3 | brouillon |

16 cas en 5 familles. La version courte en garde 8, les plus cités en atelier : DCE, veille AO, CCTP, pièces écrites,
note de calcul, normes, archives, mails.

**Prérequis bloquant pour la publication** : 11 de ces cas sont en brouillon (`draft_ai`) dans la Processothèque. Or la
règle de la Processothèque est que rien ne devient public avant validation. Il faut donc les valider dans
`/admin/validation` avant d'en publier le texte (Q8). Les deux cas « à créer » sont des trous du catalogue BE ; ils
alimentent la Processothèque en retour.

### 6.5 Catalogue transversal

Il s'applique aux maillons sans catalogue propre. Il compte 10 cas : `TRV_LIRE_DCE`, `TRV_VEILLE_AO`,
`TRV_PIECES_ECRITES`, `TRV_TRI_MAILS`, `TRV_DEVIS_RDV`, `TRV_TABLEAU_BORD`, `TRV_MODE_OPERATOIRE`,
`TRV_PROJETS_SIMILAIRES`, `TRV_CONTROLE_ARC` et `FACTURE`, ce dernier validé. Les familles sont celles des ateliers :
écrits, AO et commercial, administratif et mails, pilotage, capitalisation.

---

## 7. Règles de calcul

Toutes les règles vivent dans le référentiel (seuils, textes) et dans un module unique partagé par le navigateur et
le serveur.

### 7.1 Effort d'un cas

`effort = complexité Processothèque`, de 1 à 5.

Ajustement V1, à valider : +1 (5 au plus) pour un cas *Données*, ou un cas qui exige un corpus (normes, bibliothèque
de paragraphes, archives), quand le niveau Données est inférieur ou égal à 2. Le rapport le signale : « effort
relevé : vos données sont à structurer d'abord ».

### 7.2 Priorité d'un cas

`priorité = note en étoiles`, de 1 à 5. Elle vaut 3 sans note.

### 7.3 Quadrants

| | Effort ≤ 2 | Effort ≥ 3 |
|---|---|---|
| **Priorité ≥ 4** | À tester tout de suite | À cadrer |
| **Priorité ≤ 3** | Gains d'appoint | Plus tard |

### 7.4 Recommandation d'offre

Les règles s'évaluent dans l'ordre. On affiche au plus 2 offres, puis *Échanger 30 minutes* dans tous les cas.

| Règle | Condition | Recommandation |
|---|---|---|
| R1 | IA ≥ 4 et Cadre ≥ 4 | **Déployer** : assistance technique pour outiller et piloter vos cas dans la durée |
| R2 | Au moins 1 cas *À cadrer* et Cadre ≥ 3 | **Accompagnement cas d'usage** : de la mesure de départ à la solution en production |
| R3 | Au moins 1 cas *À tester tout de suite* | **Atelier découverte** : repartir en une journée avec un premier outil sur ce cas |
| R4 | IA ≤ 2 | Ressource : **Académie PerfIA niveau 1** (MOOC gratuit) |
| R5 | Données ≤ 2 | Ressource : **webinaire « Pas d'IA sans DATA »** et les 5 gestes data |

Les prix ne s'affichent pas en V1 (Q5), parce que les supports actuels divergent : le document v3, le site public et
la plaquette donnent des tarifs différents.

### 7.5 Agrégats d'une session

Ils sont calculés côté serveur et publiés **à partir de 3 réponses**, jamais nominatifs :

- nombre de diagnostics terminés ;
- répartition des niveaux par axe et moyenne ;
- moyenne de la question éclair, comparée à la mesure de référence de la session (par exemple 2,1/5 pour l'usage IA
  à l'atelier IBC du 25/09) ;
- 5 cas les plus choisis, avec leur nombre et leur priorité moyenne ;
- matrice collective : une bulle par cas, de taille proportionnelle au nombre de votes.

---

## 8. Fabrication du référentiel

```
Processothèque (Supabase, cas validés)        content/editorial.mjs (dépôt)
        │  export (script à écrire, voir ci-dessous)  │  familles, profils, libellés courts,
        ▼                                             │  type, ordre, cas « à créer », axes,
content/processotheque.snapshot.json (daté) ──────────┤  niveaux, étapes, règles, textes
                                                      ▼
                         scripts/build-referentiel.mjs
                                                      ▼
                         web/content/referentiel.json  (version = date + hash)
```

- **Écart à la mise en œuvre.** L'instantané de la version 0.1.0 est une reconstitution des fichiers SQL du dépôt
  de la Processothèque (15/10/2026), qui inclut les cas en brouillon. Le script de synchronisation depuis l'API REST
  de Supabase (clé publique, cas `validated` seulement) reste à écrire ; il remplacera la reconstitution une fois les
  cas validés.
- `editorial.mjs` (module JavaScript plutôt que YAML : aucune dépendance, commentaires possibles) porte tout ce que
  la Processothèque n'a pas : le choix des cas par profil, la famille d'affichage, le libellé court pour mobile, le
  type, l'ordre, les cas « à créer », et tout le contenu des axes.
- `build-referentiel.mjs` fusionne les deux et contrôle la cohérence. Il échoue si un code éditorial est absent de
  l'instantané, si un libellé dépasse 80 caractères, ou si une famille est vide.
- Un test vérifie que le référentiel construit est à jour par rapport aux deux sources.

---

## 9. Modèle de données (PocketBase)

### 9.1 Collections

**`sessions`**, une par intervention.

| Champ | Type | Remarque |
|---|---|---|
| `code` | texte, unique, `[a-z0-9-]{2,24}` | dans le lien `/s/<code>` |
| `title` | texte | « Restitution des ateliers des 25 ans de l'IBC » |
| `date` | date | |
| `organizer_name`, `organizer_logo` | texte, fichier | logo affiché à côté de Kosmio ✕ Xylofutur |
| `default_maillon` | liste | §6.1 |
| `flow` | `court` \| `complet` | |
| `identity_position` | `debut` \| `fin` | |
| `pulse_question` | texte | question éclair ; vide : la question par défaut du référentiel |
| `baseline` | JSON | `{ "label": "Atelier IBC 25/09", "usage_ia": 2.1, "clarte": 2.3 }` |
| `partner_consent_label` | texte | vide = pas de consentement partenaire |
| `presenter_key` | texte masqué | clé de la vue salle, générée à la création. **Écart** : gardée en clair (champ masqué, jamais renvoyé par l'API publique) pour que la page Équipe puisse afficher le lien de la vue salle ; c'est un secret de faible portée (agrégats anonymes) |
| `status` | `brouillon` \| `ouverte` \| `fermee` | une session fermée n'accepte plus de réponse |

**`diagnostics`**, une par réponse.

| Champ | Type | Remarque |
|---|---|---|
| `session` | relation facultative | vide pour le lien générique |
| `token` | texte masqué, unique | accès au rapport |
| `referentiel_version` | texte | |
| `firstname`, `lastname`, `company`, `role`, `email`, `phone`, `maillon`, `size` | textes, listes | |
| `levels` | JSON | `{ "ia": 2, "donnees": 3, "cadre": 1 }` |
| `pulse` | nombre 1-5 | |
| `cases` | JSON | `[{ "code": "SKILL_TRV_LIRE_DCE", "state": "veut", "priority": 5 }]` |
| `free_text` | texte | 280 caractères au plus |
| `result` | JSON | calculé côté serveur : étapes, efforts, quadrants, recommandations |
| `consent_processing`, `consent_contact`, `consent_partner`, `consent_news` | booléens | et `consent_text_version` |
| `source` | texte | `qr`, `lien`, `web`, plus les paramètres UTM |
| `duration_s` | nombre | du premier écran à la fin |
| `lead_status` | `nouveau` \| `contacte` \| `qualifie` \| `converti` \| `perdu` | réservé à l'équipe |
| `report_sent_at`, `crm_synced_at`, `crm_ref` | date, texte | suivi des envois et de la synchronisation |

**`users`** : comptes de l'équipe Kosmio seulement. Les inscriptions sont fermées ; les comptes se créent depuis la
console.

### 9.2 Règles d'accès et routes

| Accès | Règle |
|---|---|
| Lister, lire, modifier `diagnostics` | équipe seulement (`@request.auth.id != ""`) |
| Créer un diagnostic | route `POST /api/app/diagnostics` seulement : validation, recalcul du résultat côté serveur, champ piège anti-robot, limitation de débit ; renvoie le jeton |
| Lire son rapport | page `rapport.html#<jeton>`, données par `GET /api/app/report/<jeton>` |
| Lire une session ouverte | `GET /api/app/sessions/<code>` : champs publics seulement |
| Vue salle | `GET /api/app/sessions/<code>/live` avec la clé animateur ; agrégats de §7.5 |
| Export | `GET /api/app/export.csv?session=<code>`, équipe seulement |
| Supprimer | équipe seulement ; purge automatique (§12) |

La limitation de débit doit tenir compte d'une salle où 30 personnes partagent une même adresse IP : 60 créations par
10 minutes et par IP, contre 30 inscriptions dans le squelette.

---

## 10. Architecture : repartir de Skellyto

### 10.1 Verdict

**Oui, on repart de `Kosmio/skeleton-pocketbase`**, en version 0.3.0. Il apporte presque tout ce qui ne relève pas du
métier :

- un conteneur et une base SQLite, sans service à opérer ;
- une page HTML sans build, idéale pour un parcours mobile léger sur une 4G de salle ;
- la sécurité déjà testée : règles en base, limitation de débit, en-têtes HTTP ;
- l'envoi d'e-mails par Brevo, déjà utilisé par Kosmio ;
- un serveur MCP pour interroger les sessions et les prospects depuis Claude ;
- le déploiement Coolify et la CI GitHub ;
- les skills Claude (`/start`, `/security`, `/gdpr`, `/accessibility`).

Le MOOC PerfIA tourne déjà sur PocketBase : l'exploitation reste homogène.

L'écart principal est structurel. Skellyto suppose des membres authentifiés regroupés par organisation, alors que
perfia-eval reçoit des **réponses anonymes publiques** et n'a de comptes que pour l'équipe.

### 10.2 Ce qu'on garde, transforme ou retire

| Brique Skellyto | Décision | Guide ou action |
|---|---|---|
| PocketBase, Dockerfile, `infra/`, Makefile, CI, `tests/` | Garder | |
| `web/index.html` sans build, jetons CSS, thèmes | Garder ; réécrire l'interface en parcours | |
| `domain.js`, point unique métier | Garder ; réécrire autour de `diagnostics` et `sessions` | `rename-entity.md`, `add-field.md` |
| Durcissement, limitation de débit, `headers.pb.js` | Garder ; ajuster les limites (§9.2) | |
| Relais Brevo (`mail.pb.js`) | Garder | Envoi du rapport |
| Comptes `users` | Garder pour l'équipe, inscriptions fermées | `single-organisation.md`, option 2 |
| Multi-organisation par domaine d'e-mail | Retirer | `single-organisation.md` |
| `items`, votes, commentaires | Retirer | `remove-votes-comments.md` |
| Progression, équipes, relecture, pièces jointes | Retirer | `remove-progression.md`, plus les migrations du tronc commun |
| Notifications par cron | Retirer | `remove-notifications.md`, en gardant le relais Brevo |
| IA vocale (`ai.js`) | Retirer en V1 | `remove-ai.md`. La dictée de l'irritant libre est une piste V2. |
| Serveur MCP et OAuth | Garder, réservé à l'équipe ; outils réécrits | `list_sessions`, `session_stats`, `list_diagnostics`, `set_lead_status` |
| Statistiques publiques (`stats.pb.js`) | Transformer en vue salle, avec le seuil de 3 réponses | |
| Mascotte Skellyto | Retirer | Remplacée par les logos PerfIA |

### 10.3 Mise en route

1. Cloner le squelette dans `perfia-eval/`, rattacher le remote `origin` au dépôt `mathieu-kosmio/perfia-eval`, puis
   lancer `/start`. Le wizard vérifie le remote et applique les guides dans l'ordre : renommage, retraits, ajouts.
2. Domaine : par exemple `diag.kosm.io`, ou `diagnostic.ia-automatisation.kosm.io` (Q9). Déploiement Coolify,
   sauvegardes S3, expéditeur Brevo validé.
3. Le squelette est privé et sous licence MIT ; perfia-eval est **public**. Voir Q2 avant le premier push.

### 10.4 Alternatives écartées

| Option | Pourquoi pas en V1 |
|---|---|
| Module public de la Processothèque (Next.js, Supabase) | Application connectée avec sa propre gouvernance ; un formulaire public anonyme y élargit la surface d'attaque ; pile plus lourde |
| Référentiel Certifiko existant | 35 questions, pas de parcours mobile, pas de cas d'usage par maillon |
| Page statique du site public avec `/api/lead` | Pas de sessions, pas de stockage des réponses, pas de vue salle. Elle reste valable pour le lot 0 (§14). |

---

## 11. Design

### 11.1 Ce qu'on reprend du design de référence

Les captures fournies (27 écrans) restent hors du dépôt. Elles montrent l'outil d'un autre cabinet. On reprend les
**principes d'interaction**, pas la marque, les textes ni les illustrations :

- un indicateur en 5 pastilles numérotées et libellées (Vous, Maturité, Cas, Priorité, Roadmap), cochées une fois
  franchies ;
- un fond en dégradé sombre, des cartes translucides aux coins arrondis, du texte blanc et des accents verts, un
  sous-titre en italique de couleur accent sous chaque titre ;
- des boutons *Précédent* (contour) et *Suivant* (plein) en bas d'écran, larges et faciles à toucher ;
- pour la maturité : une carte par axe, un carrousel de niveaux illustrés, un badge « Choisi » ;
- pour les cas : des familles en accordéon avec icône et compteur « 0 / 3 sélectionné », un compteur global ;
- pour la priorité : 5 étoiles par cas ;
- pour la feuille de route : des étapes numérotées par axe, des tableaux par type avec jauge d'effort, une matrice à
  bulles groupées et une légende, un écran de remerciement avec 3 actions ;
- pour le rapport : une vue document avec le bouton *Imprimer / PDF*, une légende numérotée E/P, des tableaux par
  type.

### 11.2 Identité

- **Charte co-brandée PerfIA** (Kosmio × Xylofutur), celle de tous les supports PerfIA : vert Xylofutur `#00B194`
  pour les actions, encre `#1F2D3D` pour les fonds sombres, sauge `#7C9E98`, or `#BA8748`. Titres en Helvetica Neue,
  texte en Inter, micro-libellés en JetBrains Mono. Source : `112-PerfIA-Bois/design-system/`. Voir Q6.
- Couleurs des types : IA en vert, Automatisation en or, Données en sauge. Elles ne servent jamais seules : chaque
  type a aussi un libellé.
- En-tête : logo Kosmio, « ✕ », logo Xylofutur, puis le logo de l'organisateur de la session. Les logos Kosmio sont
  les fichiers officiels de `kosmio-plugin/skills/charte-kosmio/assets/logos/`, jamais redessinés.
- Fond : dégradé encre vers vert profond. Le vert `#00B194` sur blanc ne fait que 3:1 : il est réservé aux grands
  éléments et aux graphiques, et `#009982` sert pour le texte.
- Thème sombre par défaut, comme le design de référence. La feuille d'impression est claire.

### 11.3 Mobile et accessibilité

- Largeur cible 360 à 430 px, zones tactiles de 48 px minimum, aucun défilement horizontal.
- Contrastes AA (4,5:1 pour le texte, 3:1 pour les composants), focus visible, `prefers-reduced-motion` respecté.
- Étoiles en groupe de radios, jauges et matrice doublées d'un texte (« effort 2 sur 5 »), accordéons en
  `<details>` ou avec `aria-expanded`.

---

## 12. Données personnelles et sécurité

- **Responsable de traitement** : Kosmio. Le co-éditeur Xylofutur et l'organisateur ne reçoivent des données
  nominatives qu'avec le consentement 3.
- **Finalités** : établir et envoyer la feuille de route (consentement 1) ; recontact commercial (consentement 2) ;
  transmission à l'organisateur (consentement 3) ; invitations (consentement 4). Les agrégats anonymes servent à la
  restitution des sessions et à la connaissance de la filière.
- **Durée** : 3 ans à compter du dernier contact pour les prospects. Sans consentement de recontact, l'identité est
  effacée 12 mois après la fin du diagnostic et seules les réponses anonymes sont gardées. La purge passe par un cron
  PocketBase.
- **Hébergement** : en Union européenne (serveur Coolify Kosmio), sauvegardes S3 en UE. Aucun traceur tiers, aucune
  police chargée depuis un service externe, aucun cookie.
- **Notice** : une page « Vos données » courte, avec le contact pour exercer les droits.
- **Visio enregistrée** : si la session a lieu dans une visio enregistrée, l'animateur ne projette que la vue salle
  agrégée, jamais une réponse individuelle.
- **Sécurité** : voir §9.2. Les tests rejouent l'accès à un rapport sans jeton, l'énumération des diagnostics, la
  lecture d'une session fermée, l'accès à la vue salle sans clé et l'injection dans les champs libres.

---

## 13. Exigences non fonctionnelles

| Exigence | Cible |
|---|---|
| Poids de la page, hors illustrations | ≤ 150 Ko compressés ; illustrations ≤ 40 Ko chacune, chargées à l'étape 2 |
| Premier affichage sur 4G | ≤ 2 s |
| Réseau instable | Le diagnostic est gardé en local ; l'envoi est rejoué jusqu'à 3 fois, puis on propose de réessayer |
| Charge | 100 diagnostics simultanés pour une conférence, sans dégradation |
| Navigateurs | Safari iOS 16+, Chrome Android 110+, Chrome, Edge et Firefox récents |
| Langue | Français ; textes dans le référentiel, prêts pour une traduction ultérieure |
| Sobriété | Aucune dépendance front, aucun appel à un modèle d'IA dans le parcours, un conteneur |

---

## 14. Lots et calendrier

### Lot 0 : demain, 16/10 (à décider ce soir, Q1)

Le contexte : une visio Teams de restitution IBC, de 10 h à 12 h, 10 minutes par atelier, enregistrée, devant les
listes de membres IBC. Le public suit sur ordinateur ; le QR code ou le lien dans le chat mène au téléphone ou au
navigateur.

| Option | Contenu | Effort | Risque |
|---|---|---|---|
| **A. Version express ce soir** | Une page `diag-be.html` sur le site public existant, comme `choix-ia.html`. Version courte BE : identité courte, 3 axes, 8 cas, priorité, feuille de route à l'écran avec impression. Envoi par `POST /api/lead` (liste Brevo et e-mail de notification avec les réponses), source `diag-ibc-2026-10-16`. | 2 à 3 h, plus le déploiement du site | Mise en ligne de nuit ; pas de vue salle ; réponses stockées dans des e-mails ; accord de l'IBC à obtenir pour une passation pendant une visio enregistrée |
| **B. Lien différé** | Demain, une diapositive « Recevez votre feuille de route IA de bureau d'études » avec QR code vers une page d'attente qui collecte l'e-mail par `/api/lead`. Le lien du vrai diagnostic part avec le replay de l'IBC, dès que la V1 est en ligne. | 30 min | Faible ; on perd l'effet « en direct » |

Recommandation : **B**, sauf si l'IBC a déjà accepté une passation en direct. La V1 complète, avec la vue salle,
servira pour le webinaire Xylofutur du 26/11 et la Journée de l'innovation du 3/12.

### Lot 1 : V1 (développé le 15/10/2026, version 0.1.1, en ligne sur `perfia-eval.kosm.io`)

- Fait : socle Skellyto allégé ; parcours complet et version courte ; identité au début ou à la fin ; sessions ;
  rapport imprimable ; envoi par e-mail ; vue salle ; page Équipe (sessions, QR code, suivi, export CSV, clé MCP) ;
  serveur MCP ; notice données ; conservation automatique ; 31 tests d'intégration ; vérification dans le navigateur.
- Fait, au-delà du lot : catalogues Scierie et Menuiserie ; ordre des familles selon la fonction ; remarque pour les
  structures de 1 à 5 personnes sur les cas peu adaptés ; 5 illustrations SVG communes aux trois axes.
- Fait le 15/10 : déploiement Coolify sur `perfia-eval.kosm.io`, envoi Brevo vérifié en production, session `ibc`.
- Reste à faire : sauvegardes S3 ; comptes de l'équipe ; validation des cas en brouillon dans la Processothèque ;
  script de synchronisation de l'instantané.

### Lot 2 : V1.1 puis V2

- Profils Négoce, Exploitation et Transport après validation de leurs cas.
- Synchronisation vers le pipe Notion (Q7) et nourrissage Brevo selon le niveau.
- Mesure avant et après une intervention, avec la même question éclair en ouverture et en clôture.
- Repère filière : se comparer aux agrégats anonymes de son maillon (seuil de 3 organisations).
- Intégration sur les sites PerfIA et Xylofutur et dans le MOOC, en iframe ou par lien.
- Dictée vocale de l'irritant libre.

---

## 15. Questions ouvertes

| # | Question | Proposition |
|---|---|---|
| Q1 | Demain : version express (A) ou lien différé (B) ? | B, sauf accord IBC déjà obtenu |
| Q2 | Le dépôt `perfia-eval` est public. On le garde public ? | Le passer en privé tant que le contenu n'est pas validé ; ne jamais y mettre de nom de prospect |
| Q3 | 3 axes (IA, Données, Cadre) ou 2 comme le design de référence ? | 3 |
| Q4 | Noms des niveaux en stades forestiers (Semis à Futaie) ? | Oui, avec une phrase claire sous chaque nom |
| Q5 | Afficher les prix des offres ? | Non en V1, tant que les supports divergent |
| Q6 | Charte co-brandée PerfIA ou charte Kosmio (règle 8 du CLAUDE.md) ? | Charte PerfIA, avec les logos Kosmio officiels |
| Q7 | Où vont les prospects : base Clients PerfIA (Cockpit / D1) ou DB Projects (chantier C8) ? | Export CSV en V1, synchronisation une fois C8 tranché |
| Q8 | Qui valide les 11 cas BE et transversaux en brouillon, et quand ? | Mathieu, avant la mise en ligne de la V1 |
| Q9 | Quel domaine ? | Décidé le 15/10 : `perfia-eval.kosm.io` |
| Q10 | Identité au début ou à la fin du parcours ? | Au début en session, à la fin pour le lien générique |
| Q11 | L'organisateur (IBC) reçoit-il les contacts de ses membres consentants, ou seulement l'agrégat ? | L'agrégat par défaut, les contacts avec le consentement 3 |

---

## Annexe A : correspondance avec les mesures existantes

| perfia-eval | Mesure d'origine | Comparabilité |
|---|---|---|
| Niveau IA de 1 à 5 | Passeport IBC, « usage de l'IA » de 1 à 5 | Directe : mêmes 5 crans, libellés rapprochés |
| Question éclair « clarté de la valeur » | Passeport IBC, même question, de 1 à 5 | Directe |
| Niveau Données | Autodiag v2, blocs B et C | Indicative |
| Niveau Cadre | Autodiag v2, blocs E et F ; piliers de la table ronde IBC | Indicative |
| Priorité en étoiles | Fiche BET, « poids de la tâche » de 1 à 5 | Directe |
| Quadrants | Priorisation des ateliers 2026 (« à tester tout de suite », « à cadrer ») | Même vocabulaire |

## Annexe B : sources

- Inventaire de la Processothèque : `perfia-processotheque/supabase/seed.sql` et
  `supabase/migrations/20261005120000_cas_usage_ateliers_2026.sql` (cas des ateliers), `20260703150800_quality_pass_bureau_etudes.sql`
  (processus BE).
- Contenu PerfIA : voir le tableau du §1.1.
- Squelette : `Kosmio/skeleton-pocketbase`, `README.md`, `CLAUDE.md`, `docs/architecture.md`,
  `docs/modele-de-donnees.md`, `.claude/skills/start/`.
