# Serveur MCP de l'équipe

Le serveur MCP permet à Claude (ou à un autre agent) de consulter les sessions et les prospects et de mettre à jour
leur suivi, avec les droits du membre de l'équipe qui l'a autorisé. Les participants n'y ont pas accès.

## Se connecter

1. Ouvrir `/equipe.html`, se connecter, puis « Connecter un agent IA » > « Générer une clé » (valable 30 jours,
   affichée une seule fois).
2. Claude Code :

   ```bash
   claude mcp add --transport http perfia https://<domaine>/mcp --header "Authorization: Bearer <clé>"
   ```

3. Connecteurs qui ne savent pas envoyer d'en-tête (claude.ai, ChatGPT) : ajouter l'URL `https://<domaine>/mcp` ;
   l'autorisation OAuth 2.1 s'ouvre dans le navigateur.

Découverte : `/llms.txt`, `/.well-known/mcp.json`, `GET /mcp`.

## Outils

| Outil | Rôle |
|---|---|
| `list_sessions` | sessions, statut, nombre de diagnostics ; filtre par statut |
| `session_stats` | agrégats anonymes d'une session (niveaux par axe, question éclair, cas les plus choisis) |
| `list_diagnostics` | prospects, filtres : session, statut de suivi, recontact accepté |
| `get_diagnostic` | un diagnostic complet : axes et étapes, cas avec effort, priorité et quadrant, offres |
| `set_lead_status` | change le statut de suivi et les notes ; n'envoie rien |

Prompt : `preparer_relances` (brouillons de relance pour les participants d'une session qui acceptent d'être
recontactés, sans envoi).

## Sécurité

- Clés `ak_` + 40 caractères, empreinte SHA-256 en base, 30 jours, révoquées au changement de mot de passe.
- Les outils appellent l'API REST en boucle locale avec le jeton du membre : mêmes règles d'accès que la page Équipe.
- Lots JSON-RPC bornés à 20 messages ; limitation de débit sur `/mcp` et `/oauth/`.
