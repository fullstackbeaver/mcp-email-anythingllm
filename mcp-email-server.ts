import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import * as nodemailer from "nodemailer";
import * as Imap from "imap";
import { simpleParser } from "mailparser";

interface EmailConfig {
  // Gmail OAuth2
  gmail?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    accessToken?: string;
  };
  // IMAP/SMTP standard
  imap?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
}

class EmailMCPServer {
  private server: Server;
  private config: EmailConfig;
  private gmail?: any;
  private imapConnection?: any;
  private smtpTransporter?: any;

  constructor(config: EmailConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: "email-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private async initializeGmail() {
    if (!this.config.gmail) return;

    const oauth2Client = new google.auth.OAuth2(
      this.config.gmail.clientId,
      this.config.gmail.clientSecret,
      "urn:ietf:wg:oauth:2.0:oob"
    );

    oauth2Client.setCredentials({
      refresh_token: this.config.gmail.refreshToken,
      access_token: this.config.gmail.accessToken,
    });

    this.gmail = google.gmail({ version: "v1", auth: oauth2Client });
  }

  private async initializeImap() {
    if (!this.config.imap) return;

    this.imapConnection = new Imap(this.config.imap);
  }

  private async initializeSmtp() {
    if (!this.config.smtp) return;

    this.smtpTransporter = nodemailer.createTransporter({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: {
        user: this.config.smtp.user,
        pass: this.config.smtp.password,
      },
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "create_draft",
            description: "Créer un brouillon d'email",
            inputSchema: {
              type: "object",
              properties: {
                to: { type: "string", description: "Destinataire" },
                subject: { type: "string", description: "Sujet" },
                body: { type: "string", description: "Corps du message" },
                cc: { type: "string", description: "Copie (optionnel)" },
                bcc: { type: "string", description: "Copie cachée (optionnel)" },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["to", "subject", "body", "provider"],
            },
          },
          {
            name: "send_email",
            description: "Envoyer un email",
            inputSchema: {
              type: "object",
              properties: {
                to: { type: "string", description: "Destinataire" },
                subject: { type: "string", description: "Sujet" },
                body: { type: "string", description: "Corps du message" },
                cc: { type: "string", description: "Copie (optionnel)" },
                bcc: { type: "string", description: "Copie cachée (optionnel)" },
                provider: { type: "string", enum: ["gmail", "smtp"], description: "Fournisseur email" }
              },
              required: ["to", "subject", "body", "provider"],
            },
          },
          {
            name: "reply_email",
            description: "Répondre à un email",
            inputSchema: {
              type: "object",
              properties: {
                messageId: { type: "string", description: "ID du message original" },
                body: { type: "string", description: "Corps de la réponse" },
                replyAll: { type: "boolean", description: "Répondre à tous" },
                provider: { type: "string", enum: ["gmail", "smtp"], description: "Fournisseur email" }
              },
              required: ["messageId", "body", "provider"],
            },
          },
          {
            name: "search_by_subject",
            description: "Rechercher des emails par sujet",
            inputSchema: {
              type: "object",
              properties: {
                subject: { type: "string", description: "Sujet à rechercher" },
                maxResults: { type: "number", description: "Nombre max de résultats", default: 10 },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["subject", "provider"],
            },
          },
          {
            name: "search_by_sender",
            description: "Rechercher des emails par expéditeur",
            inputSchema: {
              type: "object",
              properties: {
                sender: { type: "string", description: "Email de l'expéditeur" },
                maxResults: { type: "number", description: "Nombre max de résultats", default: 10 },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["sender", "provider"],
            },
          },
          {
            name: "search_by_content",
            description: "Rechercher des emails contenant du texte",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Texte à rechercher" },
                maxResults: { type: "number", description: "Nombre max de résultats", default: 10 },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["query", "provider"],
            },
          },
          {
            name: "get_unread_emails",
            description: "Récupérer les emails non lus",
            inputSchema: {
              type: "object",
              properties: {
                maxResults: { type: "number", description: "Nombre max de résultats", default: 20 },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["provider"],
            },
          },
          {
            name: "get_important_emails",
            description: "Récupérer les emails marqués importants",
            inputSchema: {
              type: "object",
              properties: {
                maxResults: { type: "number", description: "Nombre max de résultats", default: 20 },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["provider"],
            },
          },
          {
            name: "mark_as_read",
            description: "Marquer un email comme lu",
            inputSchema: {
              type: "object",
              properties: {
                messageId: { type: "string", description: "ID du message" },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["messageId", "provider"],
            },
          },
          {
            name: "mark_as_important",
            description: "Marquer un email comme important",
            inputSchema: {
              type: "object",
              properties: {
                messageId: { type: "string", description: "ID du message" },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["messageId", "provider"],
            },
          },
          {
            name: "get_email_content",
            description: "Récupérer le contenu complet d'un email",
            inputSchema: {
              type: "object",
              properties: {
                messageId: { type: "string", description: "ID du message" },
                provider: { type: "string", enum: ["gmail", "imap"], description: "Fournisseur email" }
              },
              required: ["messageId", "provider"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "create_draft":
            return await this.createDraft(args);
          case "send_email":
            return await this.sendEmail(args);
          case "reply_email":
            return await this.replyEmail(args);
          case "search_by_subject":
            return await this.searchBySubject(args);
          case "search_by_sender":
            return await this.searchBySender(args);
          case "search_by_content":
            return await this.searchByContent(args);
          case "get_unread_emails":
            return await this.getUnreadEmails(args);
          case "get_important_emails":
            return await this.getImportantEmails(args);
          case "mark_as_read":
            return await this.markAsRead(args);
          case "mark_as_important":
            return await this.markAsImportant(args);
          case "get_email_content":
            return await this.getEmailContent(args);
          default:
            throw new Error(`Outil inconnu: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  // Implémentation des méthodes Gmail
  private async createDraftGmail(args: any) {
    const message = this.createEmailMessage(args);
    const response = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: Buffer.from(message).toString('base64url'),
        },
      },
    });
    return response.data;
  }

  private async sendEmailGmail(args: any) {
    const message = this.createEmailMessage(args);
    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: Buffer.from(message).toString('base64url'),
      },
    });
    return response.data;
  }

  private async searchGmail(query: string, maxResults: number = 10) {
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });
    return response.data.messages || [];
  }

  private createEmailMessage(args: any): string {
    const lines = [];
    lines.push(`To: ${args.to}`);
    if (args.cc) lines.push(`Cc: ${args.cc}`);
    if (args.bcc) lines.push(`Bcc: ${args.bcc}`);
    lines.push(`Subject: ${args.subject}`);
    lines.push('');
    lines.push(args.body);
    return lines.join('\n');
  }

  // Implémentations des outils
  private async createDraft(args: any) {
    if (args.provider === 'gmail') {
      const draft = await this.createDraftGmail(args);
      return {
        content: [
          {
            type: "text",
            text: `Brouillon créé avec l'ID: ${draft.id}`,
          },
        ],
      };
    }
    // Pour IMAP, on pourrait sauvegarder dans le dossier Drafts
    throw new Error("Création de brouillon IMAP non implémentée");
  }

  private async sendEmail(args: any) {
    if (args.provider === 'gmail') {
      const result = await this.sendEmailGmail(args);
      return {
        content: [
          {
            type: "text",
            text: `Email envoyé avec l'ID: ${result.id}`,
          },
        ],
      };
    } else if (args.provider === 'smtp') {
      const info = await this.smtpTransporter.sendMail({
        from: this.config.smtp?.user,
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        subject: args.subject,
        text: args.body,
      });
      return {
        content: [
          {
            type: "text",
            text: `Email envoyé: ${info.messageId}`,
          },
        ],
      };
    }
    throw new Error("Fournisseur non supporté");
  }

  private async replyEmail(args: any) {
    // Récupérer l'email original d'abord
    const originalEmail = await this.getEmailContent({ 
      messageId: args.messageId, 
      provider: args.provider 
    });
    
    // Créer la réponse avec les headers appropriés
    const replySubject = originalEmail.subject.startsWith('Re:') 
      ? originalEmail.subject 
      : `Re: ${originalEmail.subject}`;
    
    const replyArgs = {
      to: args.replyAll ? `${originalEmail.from}, ${originalEmail.cc || ''}` : originalEmail.from,
      subject: replySubject,
      body: args.body,
      provider: args.provider,
    };
    
    return await this.sendEmail(replyArgs);
  }

  private async searchBySubject(args: any) {
    if (args.provider === 'gmail') {
      const messages = await this.searchGmail(`subject:"${args.subject}"`, args.maxResults);
      return {
        content: [
          {
            type: "text",
            text: `Trouvé ${messages.length} emails avec le sujet "${args.subject}"`,
          },
        ],
      };
    }
    throw new Error("Recherche IMAP par sujet non implémentée");
  }

  private async searchBySender(args: any) {
    if (args.provider === 'gmail') {
      const messages = await this.searchGmail(`from:${args.sender}`, args.maxResults);
      return {
        content: [
          {
            type: "text",
            text: `Trouvé ${messages.length} emails de ${args.sender}`,
          },
        ],
      };
    }
    throw new Error("Recherche IMAP par expéditeur non implémentée");
  }

  private async searchByContent(args: any) {
    if (args.provider === 'gmail') {
      const messages = await this.searchGmail(`"${args.query}"`, args.maxResults);
      return {
        content: [
          {
            type: "text",
            text: `Trouvé ${messages.length} emails contenant "${args.query}"`,
          },
        ],
      };
    }
    throw new Error("Recherche IMAP par contenu non implémentée");
  }

  private async getUnreadEmails(args: any) {
    if (args.provider === 'gmail') {
      const messages = await this.searchGmail('is:unread', args.maxResults);
      return {
        content: [
          {
            type: "text",
            text: `${messages.length} emails non lus trouvés`,
          },
        ],
      };
    }
    throw new Error("Récupération emails non lus IMAP non implémentée");
  }

  private async getImportantEmails(args: any) {
    if (args.provider === 'gmail') {
      const messages = await this.searchGmail('is:important', args.maxResults);
      return {
        content: [
          {
            type: "text",
            text: `${messages.length} emails importants trouvés`,
          },
        ],
      };
    }
    throw new Error("Récupération emails importants IMAP non implémentée");
  }

  private async markAsRead(args: any) {
    if (args.provider === 'gmail') {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: args.messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Email ${args.messageId} marqué comme lu`,
          },
        ],
      };
    }
    throw new Error("Marquage comme lu IMAP non implémenté");
  }

  private async markAsImportant(args: any) {
    if (args.provider === 'gmail') {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: args.messageId,
        requestBody: {
          addLabelIds: ['IMPORTANT'],
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Email ${args.messageId} marqué comme important`,
          },
        ],
      };
    }
    throw new Error("Marquage comme important IMAP non implémenté");
  }

  private async getEmailContent(args: any) {
    if (args.provider === 'gmail') {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: args.messageId,
      });
      
      // Extraire les informations importantes
      const headers = message.data.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value;
      const from = headers.find((h: any) => h.name === 'From')?.value;
      const to = headers.find((h: any) => h.name === 'To')?.value;
      const date = headers.find((h: any) => h.name === 'Date')?.value;
      
      return {
        id: message.data.id,
        subject,
        from,
        to,
        date,
        snippet: message.data.snippet,
      };
    }
    throw new Error("Récupération contenu IMAP non implémentée");
  }

  async start() {
    await this.initializeGmail();
    await this.initializeImap();
    await this.initializeSmtp();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Serveur MCP Email démarré");
  }
}

// Configuration - à adapter selon vos besoins
const config: EmailConfig = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
    accessToken: process.env.GMAIL_ACCESS_TOKEN,
  },
  imap: {
    host: process.env.IMAP_HOST || "",
    port: parseInt(process.env.IMAP_PORT || "993"),
    secure: true,
    user: process.env.IMAP_USER || "",
    password: process.env.IMAP_PASSWORD || "",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
  },
};

const server = new EmailMCPServer(config);
server.start().catch(console.error);