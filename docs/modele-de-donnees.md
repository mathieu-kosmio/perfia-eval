# Modèle de données

Défini dans `pocketbase/pb_schema.json`, importé au premier démarrage par `pb_migrations/1757500000_import_schema.js`.

## Collections

### `sessions` (`perfsessions001`)

Une session par intervention.

| Champ | Type | Remarque |
|---|---|---|
| `code` | texte unique, `^[a-z0-9][a-z0-9-]*$`, 2 à 24 | lien court `/s/<code>` ; mis en minuscules par le hook |
| `title` | texte, 3 à 140 | |
| `date` | date | |
| `organizer_name`, `organizer_logo` | texte, image (300 Ko, public) | logo affiché à côté de Kosmio ✕ Xylofutur |
| `default_maillon` | texte | code d'un maillon du référentiel, contrôlé par le hook |
| `flow` | `court` \| `complet` | défaut `complet` |
| `identity_position` | `debut` \| `fin` | défaut `debut` |
| `pulse_question` | texte, 200 | vide : question par défaut du référentiel |
| `baseline` | JSON | mesure de référence pour la vue salle, ex. `{ "label": "Atelier IBC 25/09", "usage_ia": 2.1, "clarte": 2.3 }` |
| `partner_consent_label` | texte, 200 | vide : pas de consentement de partage proposé |
| `presenter_key` | texte **masqué** | clé de la vue salle, générée à la création |
| `status` | `brouillon` \| `ouverte` \| `fermee` | défaut `brouillon` ; seule une session ouverte accepte des réponses |
| `notes` | texte | interne |

Règles : tout est réservé à l'équipe. Une session qui a des diagnostics ne se supprime pas (on la ferme).

### `diagnostics` (`perfdiagnost001`)

Une réponse. Créée uniquement par `POST /api/app/diagnostics`.

| Champ | Type | Remarque |
|---|---|---|
| `session` | relation facultative | vide pour le lien sans session |
| `token` | texte **masqué**, unique | jeton du rapport, 32 caractères |
| `referentiel_version` | texte | |
| `flow` | `court` \| `complet` | |
| `firstname`, `lastname`, `company`, `role`, `email`, `phone`, `maillon`, `size` | textes | `role`, `maillon`, `size` : codes du référentiel |
| `levels` | JSON | `{ "ia": 2, "donnees": 3, "cadre": 1 }` |
| `pulse` | nombre 0 à 5 | 0 = pas de réponse |
| `cases` | JSON | `[{ "code": "SKILL_TRV_LIRE_DCE", "state": "veut" \| "deja", "priority": 1..5 \| null }]` |
| `free_text` | texte, 280 | |
| `result` | JSON | résultat recalculé par le serveur (voir `scoring.compute`) |
| `consent_processing`, `consent_contact`, `consent_partner`, `consent_news` | booléens | `consent_partner` forcé à faux si la session ne le propose pas |
| `consent_text_version` | texte | version du texte des consentements (`domain.js`) |
| `source`, `duration_s` | texte, nombre | |
| `lead_status` | `nouveau` \| `contacte` \| `qualifie` \| `converti` \| `perdu` | suivi par l'équipe |
| `notes` | texte | interne |
| `report_status`, `report_attempts`, `report_sent_at` | | envoi de la feuille de route par e-mail |
| `report_requests` | nombre | renvois demandés par le participant (3 au plus) |
| `brevo_synced_at` | date | inscription à la liste Brevo des invitations (consentement 4) |
| `crm_ref`, `crm_synced_at` | | synchronisation future vers le pipe Notion |
| `anonymized` | booléen | identité effacée par la tâche de conservation |

Règles : lecture et suivi réservés à l'équipe ; l'équipe ne peut modifier ni `token`, ni `result`, ni `levels`, ni
`cases`.

### `users` (`_pb_users_auth_`)

Comptes de l'équipe Kosmio : `name`, `email`. Inscriptions fermées (`createRule` nulle), connexion réservée aux
adresses vérifiées. Chaque membre ne voit que son propre compte.

### `api_keys`, `oauth_clients`

Clés MCP personnelles (empreinte SHA-256 masquée, 30 jours) et clients OAuth enregistrés dynamiquement. Hérités du
squelette, inchangés.

## Résultat d'un diagnostic (`result`)

```json
{
  "version": "2026-10-15.250dad6b",
  "catalogue": "bureau_etudes",
  "axes": [{ "code": "ia", "label": "Usages de l'IA", "n": 2, "niveau": "Fourré", "titre": "…", "tags": [], "steps": ["…", "…", "…"] }],
  "cases": [{ "num": 1, "code": "SKILL_TRV_LIRE_DCE", "label": "…", "type": "ia", "priority": 5, "effort": 2, "effort_base": 2, "ajuste": false, "quadrant": "tester", "vigilance": "…", "note_tpe": "", "statut": "draft_ai" }],
  "acquis": [{ "code": "SKILL_TRV_TRI_MAILS", "label": "…", "type": "automatisation" }],
  "par_type": { "ia": [1], "automatisation": [], "donnees": [] },
  "matrix": [{ "effort": 2, "priority": 5, "nums": [1], "types": ["ia"] }],
  "quadrants": { "tester": [1], "cadrer": [], "appoint": [], "plus_tard": [] },
  "offres": [{ "code": "atelier", "titre": "Atelier découverte", "texte": "…" }],
  "ressources": [{ "code": "mooc", "titre": "…", "texte": "…", "url": "…" }],
  "vigilances": ["…"]
}
```

## Routes

| Route | Accès | Rôle |
|---|---|---|
| `GET /s/{code}` | public | redirige vers `/?s={code}` |
| `GET /api/app/referentiel` | public | version du référentiel servi |
| `GET /api/app/sessions/{code}` | public | champs publics d'une session ouverte ou fermée (404 en brouillon) |
| `POST /api/app/diagnostics` | public | dépôt ; 201 avec `token` et `result`, 400 avec un message par champ |
| `GET /api/app/report/{token}` | public, jeton | rapport, sans e-mail ni téléphone (adresse masquée seulement) ; 404 si inconnu ou de plus de 12 mois |
| `POST /api/app/report/{token}/email` | public, jeton | renvoi de la feuille de route par e-mail ; 202, puis 429 après 3 renvois |
| `GET /api/app/sessions/{code}/live` | clé animateur (`X-Presenter-Key`) | agrégats anonymes ; rien sous 3 réponses |
| `GET /api/app/staff/sessions` | équipe | sessions avec clé animateur et nombre de diagnostics |
| `GET /api/app/export.csv?session=code` | équipe | export CSV (`;`, BOM UTF-8), formules neutralisées |
| `POST /api/app/keys` | équipe | clé MCP personnelle |
| `/mcp`, `/llms.txt`, `/.well-known/*`, `/oauth/*` | voir `docs/mcp.md` | serveur MCP et OAuth |
