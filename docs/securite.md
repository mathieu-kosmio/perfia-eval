# Sécurité et données personnelles

## Principes

1. **La base décide.** Les règles d'accès de `pb_schema.json` ne laissent rien au public : `sessions` et
   `diagnostics` sont réservées à l'équipe. Le public ne passe que par les routes de `diag.pb.js`, qui choisissent les
   champs qu'elles renvoient.
2. **Pas de compte pour les participants**, donc pas de mot de passe à protéger côté public. Les comptes d'équipe sont
   créés dans la console et exigent une adresse vérifiée.
3. **Rien de nominatif hors de l'équipe.** Rapport lisible seulement avec son jeton, sans e-mail ni téléphone ; vue
   salle anonyme, à partir de 3 réponses.
4. **Le serveur recalcule.** Un client modifié ne peut ni choisir son résultat ni proposer un cas hors de son
   catalogue.
5. **Chaque protection a son test** dans `tests/api.test.mjs`.

## Qui peut faire quoi

| Acteur | Peut | Ne doit jamais obtenir |
|---|---|---|
| Visiteur anonyme | lire une session ouverte, déposer un diagnostic, lire son rapport avec son jeton | la liste des sessions ou des diagnostics, un autre rapport, une donnée nominative, la clé animateur |
| Animateur | lire les agrégats anonymes de sa session avec la clé | des réponses individuelles |
| Membre de l'équipe | lire les sessions et les diagnostics, créer et modifier une session, suivre les prospects, exporter | modifier les réponses ou le résultat d'un diagnostic, lire un jeton de rapport |
| Agent IA (clé ou OAuth) | les droits du membre qui l'a autorisé | davantage ; survivre au changement de mot de passe du membre |
| Superutilisateur | tout, depuis la console | hors modèle : protéger ce compte |

## Protections

| Protection | Où | Test |
|---|---|---|
| Inscriptions fermées | `users.createRule = null` | les inscriptions sont fermées |
| Sessions et diagnostics invisibles du public | règles `@request.auth.collectionName = "users"` | un anonyme ne liste ni ne lit… |
| Création de diagnostic par la seule route de dépôt | `diagnostics.createRule = null` | un anonyme ne liste ni ne lit les diagnostics |
| Validation et recalcul serveur | `scoring.validate`, `scoring.compute` | le serveur recalcule le résultat… ; un cas hors catalogue est refusé |
| Champ piège anti-robot | `createDiagnostic` | le champ piège arrête les robots |
| Session fermée ou en brouillon refusée | `createDiagnostic`, route de session | une session fermée refuse… |
| Consentement de partage seulement si la session le prévoit | `scoring.validate` | le consentement de partage… |
| Jeton du rapport : 32 caractères aléatoires, masqué, dans le fragment de l'adresse, 12 mois | `diag.js`, `rapport.js` | un jeton inconnu ou mal formé ne révèle rien |
| Rapport sans e-mail ni téléphone (adresse masquée) | `reportFor` | le rapport se lit avec son jeton… |
| Renvoi par e-mail borné à 3 par diagnostic, vers l'adresse enregistrée seulement | `requestReport` | le rapport donne l'adresse masquée et permet 3 renvois… |
| Clé animateur masquée, passée en en-tête | `liveFor`, `salle.js` | la vue salle exige la clé animateur |
| Agrégats à partir de 3 réponses, sans nom | `scoring.aggregate` | la vue salle n'agrège qu'à partir de 3 réponses |
| Réponses et résultat non modifiables par l'équipe | `diagnostics.updateRule` | l'équipe met à jour le suivi, jamais les réponses |
| Export réservé à l'équipe, formules neutralisées | `exportCsv` | l'export CSV est réservé… |
| Limitation de débit, marge pour une salle derrière une seule adresse | migration `1792000000_security.js` | la limitation de débit est active… |
| En-têtes HTTP | `headers.pb.js` | les en-têtes de sécurité sont posés |
| Clés MCP révoquées au changement de mot de passe | `account.pb.js` | hérité du squelette |

## Données personnelles

- **Responsable de traitement** : Kosmio. Co-édition avec Xylofutur ; aucune donnée nominative transmise à un
  organisateur sans le consentement de partage.
- **Finalités et consentements** : feuille de route (obligatoire), recontact, partage avec l'organisateur,
  invitations ; chacun séparé, jamais pré-coché. Version du texte enregistrée (`consent_text_version`).
- **Conservation** : rapport consultable 12 mois ; identité effacée après 12 mois sans accord de recontact ;
  suppression 36 mois après la dernière mise à jour (tâche `perfia_retention`).
- **Hébergement** : en Union européenne (serveur Coolify Kosmio), sauvegardes S3 en Union européenne.
- **Sous-traitant e-mail** : Brevo (société française, hébergement en Union européenne) envoie les feuilles de route et
  reçoit, avec le consentement 4 seulement, le contact des participants qui demandent les invitations
  (`APP_BREVO_LIST_ID`).
- **Pas de traceur** : aucun cookie, aucune police ni script tiers ; le stockage local du navigateur ne sert qu'à
  reprendre le parcours.
- **Notice publique** : `web/donnees.html`.

## Risques résiduels

- Un jeton de rapport transféré par son destinataire donne accès au rapport (sans coordonnées) pendant 12 mois.
- La clé animateur figure dans le lien de la vue salle : ne pas partager ce lien, seulement l'écran.
- La limite de dépôt (60 par 10 minutes et par adresse) laisse passer un remplissage abusif modéré ; le tri se fait à
  l'export.
- L'instantané de la Processothèque contient des cas encore en brouillon : `build-referentiel.mjs --strict` avant une
  mise en ligne publique.

## Avant la mise en production

- [ ] Dépôt GitHub en privé tant que le contenu n'est pas validé.
- [ ] Superutilisateur avec un mot de passe fort ; comptes d'équipe vérifiés.
- [ ] URL publique de l'application réglée dans la console (liens des e-mails).
- [ ] `APP_BREVO_API_KEY` et `APP_MAIL_FROM` (expéditeur validé chez Brevo) ; e-mail de test reçu.
- [ ] Sauvegardes S3 activées.
- [ ] `node scripts/build-referentiel.mjs --strict` sans erreur.
- [ ] `make test` vert.
