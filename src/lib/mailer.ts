// Account and order emails, through Resend when RESEND_API_KEY is set (from MAIL_FROM, on a domain verified there).
// Without it, development prints them to the server log and production logs an error.
export type Mail = { to: string; subject: string; text: string };

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10 * 1000;

export async function sendMail(mail: Mail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) return sendWithResend(mail, apiKey);
  if (process.env.NODE_ENV !== "production") {
    console.info(`\n[dev mailer] To: ${mail.to}\n[dev mailer] Subject: ${mail.subject}\n${mail.text}\n[dev mailer] ----\n`);
    return true;
  }
  console.error(`mail not sent (RESEND_API_KEY is not set): "${mail.subject}"`);
  return false;
}

async function sendWithResend(mail: Mail, apiKey: string): Promise<boolean> {
  const from = process.env.MAIL_FROM;
  if (!from) {
    console.error(`mail not sent (MAIL_FROM is not set): "${mail.subject}"`);
    return false;
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return true;
    // Never log the recipient.
    const body = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
    console.error(`mail not sent: Resend ${res.status} ${body.name ?? ""} ${body.message ?? ""}`.trim(), `"${mail.subject}"`);
    return false;
  } catch (err) {
    console.error(`mail not sent: Resend unreachable (${(err as Error).message})`, `"${mail.subject}"`);
    return false;
  }
}

export { siteUrl } from "@/lib/site-url";
