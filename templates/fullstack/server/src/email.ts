import { Resend } from "resend";

export type PasswordResetSender = {
  sendPasswordReset: (email: string, token: string) => Promise<void>;
};

// Sends reset emails through Resend. Constructed only when RESEND_API_KEY is
// set; otherwise forgot-password returns success without delivering mail.
export function createPasswordResetSender(
  apiKey: string,
  from: string,
  baseUrl: string,
): PasswordResetSender {
  const resend = new Resend(apiKey);
  return {
    sendPasswordReset: async (email: string, token: string) => {
      const link = `${baseUrl}/reset-password?token=${token}`;
      const { error } = await resend.emails.send({
        from,
        to: email,
        subject: "Reset your password",
        html: `<p>Reset your password:</p><p><a href="${link}">${link}</a></p>`,
      });
      if (error) throw new Error(error.message);
    },
  };
}
