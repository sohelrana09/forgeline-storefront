"use server";

// Public endpoints of the PunchOut page. They act only on the cart the sealed PunchOut cookie names (checked against
// the associate and unit in punchoutCart), never on an id from the form.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { flash } from "@/lib/flash";
import { tooManyAttempts } from "@/lib/rate-limit";
import { punchoutEnabled } from "@/features/punchout/config";
import { PunchoutError, addToPunchoutCart, getPunchout, setPunchoutLine } from "@/features/punchout/service";

async function current() {
  if (!punchoutEnabled()) return undefined;
  const session = await getPunchout();
  if (!session) {
    await flash("error", "Your PunchOut session has ended. Please start again from your procurement system.");
    return undefined;
  }
  if (await tooManyAttempts(`punchout-cart:${session.cartId}`, 120)) {
    await flash("error", "Too many changes. Please wait a few minutes.");
    return undefined;
  }
  return session;
}

async function run(work: () => Promise<void>) {
  try {
    await work();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof PunchoutError) await flash("error", err.message);
    else {
      console.error("punchout cart change failed", (err as { body?: unknown })?.body ?? err);
      await flash("error", "That didn't work. Please try again.");
    }
  }
  refresh();
}

export async function addPunchoutLinesAction(formData: FormData) {
  const session = await current();
  if (!session) return refresh();
  const input = String(formData.get("lines") ?? "").slice(0, 10_000);
  await run(async () => {
    const { added, problems } = await addToPunchoutCart(session, input);
    if (added.length) await flash("success", `Added ${added.join(", ")}.`);
    if (problems.length) await flash("warning", problems.slice(0, 5).join(" "));
  });
}

export async function setPunchoutLineAction(formData: FormData) {
  const session = await current();
  if (!session) return refresh();
  const lineId = String(formData.get("lineId") ?? "");
  const quantity = Number(formData.get("quantity"));
  if (!/^[0-9a-f-]{36}$/.test(lineId) || !Number.isInteger(quantity) || quantity < 0 || quantity > 9999) {
    await flash("error", "Enter a quantity from 0 to 9999.");
    return refresh();
  }
  await run(() => setPunchoutLine(session, lineId, quantity));
}
