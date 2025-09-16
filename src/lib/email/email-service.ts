import { sendEmail } from './send';

export type EmailService = {
  to: string;
  subject: string;
  html: string;
};

// Diese Funktion muss je nach gewähltem E-Mail-Service implementiert werden
// (z.B. SendGrid, Amazon SES, etc.)
export async function sendEmail({ to, subject, html }: EmailService): Promise<void> {
  if (process.env.EMAIL_SERVICE === 'sendgrid') {
    // SendGrid Implementation
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM,
      subject,
      html,
    });
  } else {
    // Andere E-Mail-Service-Implementierungen hier...
    throw new Error('Kein E-Mail-Service konfiguriert');
  }
}