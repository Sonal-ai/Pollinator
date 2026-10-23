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

export class WhatsAppDeliveryError extends Error {
  constructor(public readonly outcome: 'REJECTED' | 'UNKNOWN', public readonly status?: number, public readonly providerCode?: number) {
    super(outcome === 'UNKNOWN' ? 'WhatsApp delivery outcome is unknown. Check delivery before retrying.' : 'WhatsApp rejected this request. Check provider configuration and recipient eligibility.');
  }
}

export class WhatsAppClient {
  constructor(private readonly request: typeof fetch = fetch, private readonly translate = translateResponse,
    private readonly stage?: (body: unknown) => Promise<void>) {}
  private get baseUrl(): string {
    return `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_ID}`;
  }

  private get authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    };
  }

  private async post(body: unknown): Promise<void> {
    if (this.stage) { await this.stage(body); return; }
    await this.sendPayload(body);
  }

  /** Raw, already-built message. Used only by the durable outbox sender. */
  async sendPayload(body: unknown): Promise<string | null> {
    let response: Response;
    try { response = await this.request(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    }); } catch { throw new WhatsAppDeliveryError('UNKNOWN'); }

    if (!response.ok) {
      let code: number | undefined;
      try { const error = await response.json(); if (Number.isSafeInteger(error?.error?.code) && error.error.code >= 0) code = error.error.code; } catch {}
      // A proxy error or server failure may occur after the provider accepted a send.
      const outcome = response.status >= 400 && response.status < 500 && code !== undefined ? 'REJECTED' : 'UNKNOWN';
      throw new WhatsAppDeliveryError(outcome, response.status, code);
    }
    try {
      const result = await response.json();
      if (typeof result?.messages?.[0]?.id === 'string') return result.messages[0].id;
      if (result?.success === true) return null;
    } catch {}
    // A successful HTTP response without a readable message ID is still ambiguous.
    throw new WhatsAppDeliveryError('UNKNOWN', response.status);
  }

  /**
   * Send a plain text message.
   */
  async sendText(to: string, text: string, lang: SupportedLanguage = 'en'): Promise<void> {
    const translated = await this.translate(text, lang);
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
    const translatedBody = await this.translate(text, lang);
    
    const translatedButtons = await Promise.all(
      buttons.map(async (btn) => {
        const translatedTitle = await this.translate(btn.reply.title, lang);
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
    const translatedHeader = await this.translate(headerText, lang);
    const translatedBody = await this.translate(bodyText, lang);
    const translatedButton = await this.translate(buttonLabel, lang);

    const translatedSections = await Promise.all(
      sections.map(async (sec) => {
        const translatedSecTitle = await this.translate(sec.title, lang);
        
        const translatedRows = await Promise.all(
          sec.rows.map(async (row) => {
            const translatedRowTitle = await this.translate(row.title, lang);
            const translatedRowDesc = row.description ? await this.translate(row.description, lang) : undefined;
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
  async downloadMedia(mediaId: string, limit = 16 * 1024 * 1024): Promise<Buffer> {
    // Step 1: Get the media URL from WhatsApp
    const urlResponse = await this.request(
      `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(15000) }
    );
    if (!urlResponse.ok) {
      throw new Error(`Failed to get media URL: ${urlResponse.status}`);
    }
    const { url } = await urlResponse.json() as { url: string };

    // Step 2: Download the actual file
    const mediaResponse = await this.request(url, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.status}`);
    }

    if (Number(mediaResponse.headers.get('content-length')) > limit) throw new Error('Media is too large');
    const reader = mediaResponse.body?.getReader();
    if (!reader) throw new Error('Media is empty');
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        length += part.value.length;
        if (length > limit) { await reader.cancel(); throw new Error('Media is too large'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
  }
}

// Export a singleton instance
export const whatsapp = new WhatsAppClient();
