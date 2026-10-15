# Mise en ligne sur Coolify

Fiche pas à pas pour publier PerfIA Diagnostic IA. Le guide général reste [deploiement.md](deploiement.md) ; ici, les
valeurs propres à ce projet. Aucune valeur secrète n'est écrite dans ce dépôt.

L'image a été construite et testée localement le 15/10/2026 (`docker build .` puis conteneur : santé, pages,
dépôt d'un diagnostic, rapport, en-têtes, 4 migrations appliquées).

## 0. Avant de commencer

- [ ] Le code est sur GitHub : `git push -u origin main` depuis le dépôt (`mathieu-kosmio/perfia-eval`).
- [ ] Le domaine est choisi. Proposition : `diag.kosm.io`. Dans la suite, `{domaine}` désigne ce nom.
- [ ] Décision sur les cas d'usage en brouillon : `node scripts/build-referentiel.mjs --strict` échoue tant que
      15 cas ne sont pas validés dans la Processothèque. Publier quand même (en connaissance de cause) ou valider
      d'abord.

## 1. Créer la ressource

1. Coolify > **Projects** > le projet Kosmio > **+ New** > **Docker Compose**.
2. Source : **Public repository** (le dépôt est public) ou la **GitHub App** si le dépôt passe en privé.
   URL `https://github.com/mathieu-kosmio/perfia-eval`, branche `main`.
3. **Build pack : Docker Compose**, fichier `/docker-compose.yaml`. Coolify construit le `Dockerfile` racine.
4. Ne pas ajouter de port publié : le proxy de Coolify route le trafic vers le port 8090 du conteneur.

## 2. Domaine

1. Service `app` > **Domains** : `https://{domaine}` (si Coolify demande le port : `https://{domaine}:8090`).
2. Chez le registrar de `kosm.io` : un enregistrement A (ou CNAME) de `{domaine}` vers le serveur Coolify.
   Coolify obtient le certificat HTTPS tout seul.

## 3. Variables d'environnement

Ressource > **Environment Variables** :

| Variable | Valeur | Secret |
|---|---|---|
| `APP_BREVO_API_KEY` | la clé v3 du compte Brevo « Kosmio Dev » (celle de `.local/env.sh`) | oui |
| `APP_MAIL_FROM` | `PerfIA · Kosmio <dev@kosm.io>` (seul expéditeur validé du compte, sans guillemets dans Coolify) | non |
| `APP_BREVO_LIST_ID` | `3` (liste « PerfIA ») | non |
| `APP_SEND_REPORTS` | laisser vide (l'envoi est actif) ; `0` pour une instance de test | non |

Puis **Deploy**. Suivre le journal jusqu'à « healthy » (contrôle sur `/api/health`), en 1 à 3 minutes.

## 4. Administrateur et réglages de la console

1. Ressource > **Terminal** > conteneur `app` :

   ```
   /pb/pocketbase superuser upsert vous@kosm.io 'un-mot-de-passe-long' --dir /pb/pb_data
   ```

2. `https://{domaine}/_/` > **Settings** > **Application** :
   - *Application name* : `PerfIA Diagnostic IA` (déjà posé par la migration, à vérifier) ;
   - *Application URL* : `https://{domaine}` : **indispensable**, c'est l'adresse des liens de rapport dans les
     e-mails ;
   - *User IP proxy headers* : `X-Forwarded-For` (déjà posé par la migration, à vérifier).
3. **Mail settings** : *Sender name* `PerfIA · Kosmio`, *Sender address* `dev@kosm.io`. **Send test email** vers votre
   adresse.
4. **Backups** : activer S3 (fournisseur européen), planification `0 3 * * *`, puis **Initialize new backup**.

## 5. Comptes de l'équipe et première session

1. Console > collection **users** > **New record** : e-mail, mot de passe, nom, case **verified** cochée. Un compte
   par membre de l'équipe (les inscriptions publiques sont fermées).
2. `https://{domaine}/equipe.html` > se connecter > **Nouvelle session** : code (ex. `ibc`), titre, maillon par
   défaut, version, mesure de référence, statut **Ouverte**.
3. Ou, depuis un poste, en une commande (crée le compte d'équipe et une session ouverte, affiche les liens) :

   ```
   PB_URL=https://{domaine} PB_ADMIN_EMAIL=… PB_ADMIN_PASSWORD=… STAFF_EMAIL=… STAFF_PASSWORD=… SESSION_CODE=ibc SESSION_TITLE="…" node scripts/seed-demo.mjs
   ```

## 6. Vérifications après la mise en ligne

- [ ] `https://{domaine}/api/health` répond 200.
- [ ] `https://{domaine}/api/app/referentiel` donne la même version que `web/content/referentiel.json`.
- [ ] Un diagnostic complet sur téléphone, via le QR code de la page Équipe, avec votre adresse : l'e-mail arrive,
      son lien de rapport ouvre `https://{domaine}/rapport.html#…`, le contact apparaît dans la liste Brevo 3 si
      les invitations sont cochées.
- [ ] La vue salle s'ouvre depuis la page Équipe et affiche les agrégats à partir de 3 réponses.
- [ ] L'export CSV se télécharge depuis la page Équipe.

## 7. Mises à jour

`git push` sur `main`, puis **Redeploy** dans Coolify (ou activer l'**Auto Deploy** de la ressource). Les migrations
s'appliquent au démarrage ; les données vivent dans le volume `app_data`, conservé d'un déploiement à l'autre.

## Points d'attention

- **Brevo, offre gratuite** : environ 300 e-mails par jour. Suffisant pour une intervention ; à surveiller pour un
  envoi massif.
- **Salle derrière une seule adresse IP** : la limite de dépôt est de 60 diagnostics par 10 minutes et par adresse.
  Au-delà (conférence), la relever dans la console avant l'intervention.
- **Dépôt public** : le code et la spécification sont visibles de tous. Le passer en privé change seulement la source
  dans Coolify (GitHub App au lieu de « Public repository »).
