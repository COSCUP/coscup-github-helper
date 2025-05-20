export type MattermostAttachment = Record<string, any>

export interface MattermostMessage {
  channel?: string; // Make channel optional if default is handled elsewhere or webhook defines it
  text?: string; // Make text optional as attachments are primary now
  attachments?: MattermostAttachment[]; // Add attachments property
  username?: string; // Keep other potential fields optional
  icon_url?: string;
  priority?: {
    priority: 'important' | 'urgent';
  };
}

export class MattermostClient {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendMessage(message: MattermostMessage): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message), // This correctly sends the whole object including attachments
      });

      if (!response.ok) {
        const responseBody = await response.text(); // Read response body for more details
        throw new Error(`Mattermost API Error: ${response.status} ${response.statusText} - ${responseBody}`);
      }
      console.log('Message sent successfully to Mattermost.');
    } catch (error) {
      console.error('Error sending message to Mattermost:', error);
      throw error; // Re-throw the error for upstream handling
    }
  }
}
