import { env } from '../env';
import { translateResponse, type SupportedLanguage } from './gemini';

// ============================================================
// WhatsApp Cloud API Client
// ============================================================

interface WhatsAppButton {
  type: 'reply';
  reply: { id: string; title: string };
}

interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

interface WhatsAppListSection {
  title: string;
  rows: WhatsAppListRow[];
}

class WhatsAppClient {
  private readonly baseUrl: string;

  constructor() {
    // Version is pinned to v20 for stability. Update intentionally.
    this.baseUrl = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}`;
  }

  private get authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    };
  }

  private async post(body: unknown): Promise<void> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error ${response.status}: ${error}`);
    }
  }

  /**
   * Send a plain text message.
   */
  async sendText(to: string, text: string, lang: SupportedLanguage = 'en'): Promise<void> {
    const translated = await translateResponse(text, lang);
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: translated },
    });
  }

  /**
   * Send an interactive message with up to 3 reply buttons.
   */
  async sendButtons(to: string, text: string, buttons: WhatsAppButton[], lang: SupportedLanguage = 'en'): Promise<void> {
    const translatedBody = await translateResponse(text, lang);
    
    const translatedButtons = await Promise.all(
      buttons.map(async (btn) => {
        const translatedTitle = await translateResponse(btn.reply.title, lang);
        return {
          type: btn.type,
          reply: {
            id: btn.reply.id,
            title: translatedTitle.substring(0, 20)
          }
        };
      })
    );

    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: translatedBody },
        action: { buttons: translatedButtons },
      },
    });
  }

  /**
   * Send an interactive list message (for menus with more than 3 options).
   */
  async sendList(
    to: string,
    headerText: string,
    bodyText: string,
    buttonLabel: string,
    sections: WhatsAppListSection[],
    lang: SupportedLanguage = 'en'
  ): Promise<void> {
    const translatedHeader = await translateResponse(headerText, lang);
    const translatedBody = await translateResponse(bodyText, lang);
    const translatedButton = await translateResponse(buttonLabel, lang);

    const translatedSections = await Promise.all(
      sections.map(async (sec) => {
        const translatedSecTitle = await translateResponse(sec.title, lang);
        
        const translatedRows = await Promise.all(
          sec.rows.map(async (row) => {
            const translatedRowTitle = await translateResponse(row.title, lang);
            const translatedRowDesc = row.description ? await translateResponse(row.description, lang) : undefined;
            return {
              id: row.id,
              title: translatedRowTitle.substring(0, 24),
              description: translatedRowDesc ? translatedRowDesc.substring(0, 72) : undefined
            };
          })
        );
        
        return {
          title: translatedSecTitle.substring(0, 24),
          rows: translatedRows
        };
      })
    );

    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: translatedHeader.substring(0, 60) },
        body: { text: translatedBody },
        action: {
          button: translatedButton.substring(0, 20),
          sections: translatedSections,
        },
      },
    });
  }

  /**
   * Mark a message as read (shows double blue tick to sender).
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.post({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch {
      // Non-fatal: don't block message processing if mark-read fails
    }
  }

  /**
   * Download media (voice notes, images) from WhatsApp.
   * Returns the file as a Buffer for further processing.
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    // Step 1: Get the media URL from WhatsApp
    const urlResponse = await fetch(
      `https://graph.facebook.com/v20.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` } }
    );
    if (!urlResponse.ok) {
      throw new Error(`Failed to get media URL: ${urlResponse.status}`);
    }
    const { url } = await urlResponse.json() as { url: string };

    // Step 2: Download the actual file
    const mediaResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    });
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.status}`);
    }

    return Buffer.from(await mediaResponse.arrayBuffer());
  }
}

// Export a singleton instance
export const whatsapp = new WhatsAppClient();
