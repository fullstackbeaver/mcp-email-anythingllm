# Guide d'installation - Serveur MCP Email

## Installation

1. **Cloner et installer les dépendances**
```bash
bun install
```

2. **Configurer les variables d'environnement**
```bash
cp .env.example .env
# Éditer le fichier .env avec vos configurations
```

## Configuration Gmail OAuth2

### 1. Créer un projet Google Cloud
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un existant
3. Activer l'API Gmail

### 2. Configurer OAuth2
1. Aller dans "APIs & Services" > "Credentials"
2. Créer des identifiants > "OAuth 2.0 Client IDs"
3. Type d'application : "Desktop application"
4. Télécharger le fichier JSON des credentials

### 3. Obtenir le refresh token
```bash
# Installer l'outil Google OAuth2
npm install -g google-auth-library

# Générer un refresh token
node -e "
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client('YOUR_CLIENT_ID', 'YOUR_CLIENT_SECRET', 'urn:ietf:wg:oauth:2.0:oob');
const authUrl = client.generateAuthUrl({access_type: 'offline', scope: ['https://www.googleapis.com/auth/gmail.modify']});
console.log('Visitez cette URL:', authUrl);
"
```

Suivez les instructions pour obtenir le code d'autorisation, puis :

```bash
node -e "
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client('YOUR_CLIENT_ID', 'YOUR_CLIENT_SECRET', 'urn:ietf:wg:oauth:2.0:oob');
client.getToken('YOUR_AUTH_CODE').then(({tokens}) => {
  console.log('Refresh Token:', tokens.refresh_token);
  console.log('Access Token:', tokens.access_token);
});
"
```

## Configuration IMAP/SMTP standard

### Pour les fournisseurs courants :

**Gmail (via IMAP/SMTP - alternative à OAuth2)**
```
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

**Outlook/Hotmail**
```
IMAP_HOST=imap-mail.outlook.com
IMAP_PORT=993
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
```

**Yahoo**
```
IMAP_HOST=imap.mail.yahoo.com
IMAP_PORT=993
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
```

**OVH**
```
IMAP_HOST=ssl0.ovh.net
IMAP_PORT=993
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=587
```

## Utilisation avec AnythingLLM

### 1. Démarrer le serveur MCP
```bash
bun run dev
```

### 2. Configurer AnythingLLM
Dans la configuration MCP d'AnythingLLM, ajouter :
```json
{
  "mcpServers": {
    "email": {
      "command": "bun",
      "args": ["run", "/chemin/vers/votre/serveur/index.ts"],
      "env": {
        "GMAIL_CLIENT_ID": "votre_client_id",
        "GMAIL_CLIENT_SECRET": "votre_client_secret",
        "GMAIL_REFRESH_TOKEN": "votre_refresh_token",
        "IMAP_HOST": "votre_host_imap",
        "IMAP_PORT": "993",
        "IMAP_USER": "votre_email",
        "IMAP_PASSWORD": "votre_mot_de_passe",
        "SMTP_HOST": "votre_host_smtp",
        "SMTP_PORT": "587",
        "SMTP_USER": "votre_email",
        "SMTP_PASSWORD": "votre_mot_de_passe"
      }
    }
  }
}
```

## Fonctionnalités disponibles

### 📝 Gestion des emails
- `create_draft` - Créer un brouillon
- `send_email` - Envoyer un email  
- `reply_email` - Répondre à un email
- `get_email_content` - Récupérer le contenu d'un email

### 🔍 Recherche
- `search_by_subject` - Recherche par sujet
- `search_by_sender` - Recherche par expéditeur  
- `search_by_content` - Recherche dans le contenu
- `get_unread_emails` - Emails non lus
- `get_important_emails` - Emails importants

### 🏷️ Gestion des labels
- `mark_as_read` - Marquer comme lu
- `mark_as_important` - Marquer comme important

## Exemples d'utilisation dans AnythingLLM

**Envoyer un email :**
```
Peux-tu envoyer un email à john@example.com avec le sujet "Réunion demain" et le message "Bonjour, notre réunion est confirmée pour demain à 14h."
```

**Rechercher des emails :**
```
Trouve tous les emails non lus de la semaine dernière
```

**Répondre à un email :**
```
Réponds à l'email avec l'ID abc123 en disant "Merci pour votre message, je vous recontacte bientôt."
```

## Sécurité

⚠️ **Important** : 
- Ne commitez jamais vos fichiers `.env` 
- Utilisez des mots de passe d'application pour Gmail si vous n'utilisez pas OAuth2
- Vérifiez que votre serveur IMAP/SMTP supporte les connexions sécurisées

## Développement

Pour étendre les fonctionnalités :
1. Ajoutez de nouveaux outils dans `setupToolHandlers()`
2. Implémentez les méthodes correspondantes
3. Testez avec `bun run dev`

## Résolution de problèmes

### Erreur OAuth2 Gmail
- Vérifiez que l'API Gmail est activée
- Assurez-vous que les scopes OAuth2 sont corrects
- Le refresh token doit être généré avec `access_type: 'offline'`

### Erreur IMAP/SMTP
- Vérifiez les ports et les paramètres de sécurité
- Activez "Applications moins sécurisées" si nécessaire
- Utilisez des mots de passe d'application pour Gmail

### Problème de connexion AnythingLLM
- Vérifiez que le serveur MCP démarre correctement
- Consultez les logs d'AnythingLLM pour voir les erreurs MCP