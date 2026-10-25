// Account emails (password reset, email verification). No email provider is wired up in this sandbox: in
// development each message is printed to the dev-server log so its link can be opened; in production a provider
// (SendGrid, SES, Postmark, …) goes here, and until then sending fails loudly in the log instead of silently.
export type Mail = { to: string; subject: string; text: string };

export async function sendMail(mail: Mail): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") {
    console.info(`\n[dev mailer] To: ${mail.to}\n[dev mailer] Subject: ${mail.subject}\n${mail.text}\n[dev mailer] ----\n`);
    return true;
  }
  console.error(`mail not sent (no MAIL_PROVIDER configured): "${mail.subject}"`);
  return false;
}

export { siteUrl } from "@/lib/site-url";
