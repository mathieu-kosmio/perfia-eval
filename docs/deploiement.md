# Déploiement

Deux chemins, au choix : **Coolify** (recommandé, le plus simple) ou **Docker Compose + Traefik** piloté par GitHub
Actions (le même modèle que le squelette Skelly). Dans les deux cas, l'application est une seule image et un seul
volume. Le skill `/setup-deploy` guide la configuration, `/deploy` guide la mise en ligne.

## Coolify (recommandé)

Pour ce projet, la fiche pas à pas avec les valeurs exactes est [mise-en-ligne-coolify.md](mise-en-ligne-coolify.md).

1. Pousser le dépôt sur GitHub.
2. Dans Coolify : **+ New Resource > Docker Compose**, source Git, ce dépôt, branche `main`. Coolify lit
   `docker-compose.yaml` et construit l'image depuis le `Dockerfile` racine.
3. Assigner un domaine au service `app` (port 8090). Coolify gère le certificat et le reverse proxy.
4. Renseigner les variables d'environnement utiles (cocher « secret » pour les clés), voir le tableau plus bas.
5. Déployer. Le schéma est importé automatiquement au premier démarrage.
6. Créer le superutilisateur depuis le terminal du conteneur (Coolify : ressource > *Terminal*) :
   ```bash
   /pb/pocketbase superuser upsert vous@exemple.fr 'un-mot-de-passe-solide' --dir /pb/pb_data
   ```
7. Console `/_/` > **Settings > Application** : nom de l'application et URL publique. Ils sont utilisés par les
   e-mails, la page d'autorisation OAuth et `llms.txt`.
8. **Settings > Backups** : activer les sauvegardes automatiques vers un S3. Le volume est le seul endroit où vivent
   les données.
9. Créer les comptes d'équipe dans la console (collection `users`, case `verified` cochée), ou depuis un poste :
   ```bash
   PB_URL=https://<domaine> PB_ADMIN_EMAIL=… PB_ADMIN_PASSWORD=… STAFF_EMAIL=… STAFF_PASSWORD=… SESSION_CODE=… node scripts/seed-demo.mjs
   ```
   Le script crée aussi une session ouverte et affiche le lien participants et le lien de la vue salle.

Mise à jour : `git push`, puis redéployer dans Coolify (ou activer le déploiement automatique par webhook).

## Docker Compose + Traefik (GitHub Actions)

L'infrastructure suit le modèle base + overlays de Skelly :

```
infra/deploy/base/            docker-compose.base.yml (traefik, app) et .env.base (PROJECT_SLUG, registre)
infra/deploy/overlays/local/  rien ne tourne dans Docker en local (make dev lance le binaire)
infra/deploy/overlays/dev/    Traefik + TLS, restart unless-stopped
infra/deploy/overlays/prod/   Traefik + TLS, restart always, limites mémoire
infra/deploy/scripts/deploy.sh
```

- `.github/workflows/dev.yml` construit l'image et la pousse sur GHCR à chaque push sur `main` (tag = `VERSION`).
- `.github/workflows/deploy.yml` (déclenchement manuel) copie l'infra sur le serveur par SSH, écrit les secrets,
  sauvegarde le volume si demandé, tire l'image, redémarre et vérifie `/api/health`.

Configuration GitHub : environnements `dev` et `prod`, variables `DEPLOY_HOST`, `DEPLOY_USER`, `SSH_PORT`,
`SSH_KNOWN_HOSTS`, secret `SSH_PRIVATE_KEY`, et les secrets applicatifs listés dans `deploy.yml`. Domaines dans
`overlays/*/.env.*`.

`SSH_KNOWN_HOSTS` épingle l'empreinte du serveur : sans elle, le workflow l'accepte au premier contact et affiche un
avertissement, ce qui exposerait les secrets à une interception. Pour la remplir, depuis un poste de confiance :

```bash
ssh-keyscan -p 22 serveur.exemple.fr
```

Comparer l'empreinte avec celle affichée sur le serveur (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`), puis
coller la sortie dans la variable.

```bash
./infra/deploy/scripts/deploy.sh <local|dev|prod> <up|down|logs|ps|pull|restart|config|validate|kill>
```

## Sans Docker

```bash
./scripts/pb.sh
```

Le script télécharge le binaire PocketBase dans `.local/` (archive vérifiée par SHA-256) et lance le serveur sur le
port 8090. Pour une mise en production sans conteneur, lancer le binaire derrière un reverse proxy avec TLS (Caddy,
Traefik, nginx) qui ajoute l'en-tête `X-Forwarded-For` : la limitation de débit s'en sert pour identifier le visiteur,
et ne doit jamais recevoir cet en-tête directement d'Internet.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `APP_BREVO_API_KEY` | active le relais des e-mails vers l'API Brevo |
| `APP_MAIL_FROM` | expéditeur validé chez Brevo, ex. `PerfIA · Kosmio <dev@kosm.io>` (entre guillemets dans `.local/env.sh`) |
| `APP_INTERNAL_URL` | adresse de l'API vue du serveur MCP (défaut `http://127.0.0.1:8090`) |
| `APP_BREVO_LIST_ID` | identifiant de la liste Brevo où inscrire les participants qui acceptent les invitations (facultatif ; attributs FIRSTNAME, LASTNAME, COMPANY, SOURCE) |
| `APP_SEND_REPORTS` | `0` coupe l'envoi des feuilles de route et l'inscription Brevo (instance de test, tests) |

PocketBase recharge les hooks à chaud mais hérite de l'environnement du processus : après un changement de variable, redémarrer le service.

En local, ces variables se mettent dans `.local/env.sh` (non versionné), avec `PB_ADMIN_EMAIL` et
`PB_ADMIN_PASSWORD` pour créer le superutilisateur au lancement.

## E-mails

**Un canal d'envoi est indispensable en production** : chaque participant reçoit sa feuille de route par e-mail
(tâche `perfia_reports`, chaque minute, 3 essais). Deux options : l'API Brevo (`APP_BREVO_API_KEY`, `APP_MAIL_FROM`,
expéditeur validé chez Brevo) ou un SMTP réglé dans la console (*Settings > Mail settings*). Le même canal sert aux
comptes d'équipe (vérification, mot de passe). Les échecs apparaissent dans les journaux et dans le champ
`report_status` des diagnostics (`echec`).

Régler l'URL publique dans la console (*Settings > Application*) : les liens des e-mails en dépendent.

## Limitation de débit et proxy

La migration `1792000000_security.js` active la limitation de débit de PocketBase et lit l'adresse du visiteur dans
`X-Forwarded-For` (valeur ajoutée par Coolify ou Traefik). Règles par adresse IP :

| Cible | Limite |
|---|---|
| Connexion superutilisateur | 10 par minute |
| Connexion d'un compte d'équipe | 30 par minute |
| E-mails de compte | 10 par 10 minutes |
| Dépôt d'un diagnostic | 60 par 10 minutes |
| Sessions et vue salle | 240 par minute |
| Rapport | 60 par minute |
| MCP | 120 par minute |
| OAuth | 20 par minute |
| Reste de l'API | 300 par 10 secondes |

Une salle entière derrière une seule adresse (Wi-Fi du lieu) reste sous la limite de dépôt jusqu'à 60 participants
en 10 minutes ; au-delà, l'augmenter dans la console avant l'intervention.

## Mise à niveau

Lire [CHANGELOG.md](../CHANGELOG.md) avant chaque redéploiement : les migrations s'appliquent au démarrage.

## Sauvegarde et restauration

Les sauvegardes PocketBase (console, **Settings > Backups**) contiennent la base et les fichiers (`pb_data/storage/`,
où vivent les logos des organisateurs). Pour restaurer : choisir la sauvegarde dans la console et cliquer
sur « Restore », ou remplacer le contenu du volume par l'archive, service arrêté. Le workflow `deploy.yml` peut
aussi archiver le volume avant chaque déploiement.


## Avant d'ouvrir au public

Parcourir la [liste de contrôle de mise en production](securite.md#avant-la-mise-en-production) : URL de
l'application, canal d'e-mail, superutilisateur protégé, sauvegardes, référentiel validé (`--strict`).

## Dimensionnement

512 Mo de mémoire suffisent largement : une instance SQLite encaisse des dizaines de milliers de diagnostics.
