import "server-only";
import { cookies } from "next/headers";
import { MESSAGES_COOKIE, parseMessages, serializeMessages, type MessageLink, type MessageType } from "@/lib/messages";

// Records a page message for the visitor (Server Actions only). It's shown by PageMessages on this page (after the
// action) or the next one. Readable by the page's script on purpose: it only ever holds our own message texts, which
// React renders as text.
export async function flash(type: MessageType, text: string, link?: MessageLink) {
  const jar = await cookies();
  const messages = [...parseMessages(jar.get(MESSAGES_COOKIE)?.value), { type, text, ...(link && { link }) }];
  jar.set(MESSAGES_COOKIE, serializeMessages(messages), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60,
  });
}
