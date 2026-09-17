import axios from 'axios';

export class WhatsAppClient {
  private phoneId: string;
  private accessToken: string;
  private baseUrl: string;

  constructor() {
    this.phoneId = process.env.WHATSAPP_PHONE_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.baseUrl = `https://graph.facebook.com/v18.0/${this.phoneId}`;
  }

  async sendText(to: string, text: string) {
    try {
      await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: text }
        },
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
    } catch (error) {
      console.error('Failed to send text:', error);
    }
  }

  async sendButtons(to: string, text: string, buttons: any[]) {
    try {
      await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text },
            action: { buttons }
          }
        },
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
    } catch (error) {
      console.error('Failed to send buttons:', error);
    }
  }

  async markAsRead(messageId: string) {
    try {
      await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }
}

export const whatsapp = new WhatsAppClient();
