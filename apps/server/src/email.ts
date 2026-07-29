export interface EmailSender {
  sendPasswordReset(to: string, token: string): Promise<void>;
}

export class ResendEmailSender implements EmailSender {
  private apiKey: string;
  private from: string;
  private baseUrl: string;

  constructor(apiKey: string, from: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.from = from;
    this.baseUrl = baseUrl;
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    if (!this.apiKey) return;
    const resetUrl = `${this.baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to,
        subject: "Reset your password",
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`,
      }),
    });
  }
}
