// Reads for the demo reset (no Next.js imports, so `npm run ct:demo-reset` can use it too).
import { apiRoot, asAssociate } from "@/lib/commercetools/client";
import { statusOf } from "@/lib/commercetools/errors";
import { str } from "@/lib/predicate";
import type { Order } from "@commercetools/platform-sdk";
import { getCustomerContexts } from "@/features/business-units/service";
import { BUDGET_CONTAINER } from "@/features/spending-limits/budget";
import { demoEmails, type DemoRole, type ResetInput } from "@/features/demo/demo";

const LIMIT = 500;
const inList = (ids: string[]) => ids.map(str).join(", ");

export type Personas = { ids: Record<DemoRole, string>; units: string[] };

async function personas(): Promise<Personas> {
  const emails = demoEmails();
  const { body } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `lowercaseEmail in (${inList(Object.values(emails))})`, limit: 10 } })
    .execute();
  const byEmail = new Map(body.results.map((c) => [c.email.toLowerCase(), c.id]));
  const ids = {} as Record<DemoRole, string>;
  for (const [role, email] of Object.entries(emails) as [DemoRole, string][]) {
    const id = byEmail.get(email);
    if (!id) throw new Error(`demo ${role} ${email} has no customer account`);
    ids[role] = id;
  }
  // The demo company: units all three personas belong to (never another unit one of them also works for).
  const unitSets = await Promise.all(
    Object.values(ids).map(async (id) => new Set((await getCustomerContexts(id)).contexts.map((c) => c.businessUnitKey))),
  );
  const units = [...unitSets[0]].filter((u) => unitSets.every((s) => s.has(u)));
  return { ids, units };
}

const refs = (results: { id: string; version: number }[]) => results.map(({ id, version }) => ({ id, version }));

export async function readReset(): Promise<{ personas: Personas; input: ResetInput }> {
  const p = await personas();
  const customers = inList(Object.values(p.ids));
  const q = (where: string) => ({ queryArgs: { where, limit: LIMIT } });

  const [quoteRequests, carts, shoppingLists, recurringOrders] = await Promise.all([
    apiRoot
      .quoteRequests()
      .get(q(`customer(id in (${customers}))`))
      .execute(),
    apiRoot
      .carts()
      .get(q(`customerId in (${customers})`))
      .execute(),
    apiRoot
      .shoppingLists()
      .get(q(`customer(id in (${customers}))`))
      .execute(),
    apiRoot
      .recurringOrders()
      .get(q(`customer(id in (${customers}))`))
      .execute(),
  ]);
  const requestIds = quoteRequests.body.results.map((r) => r.id);
  const fromRequests = requestIds.length ? `quoteRequest(id in (${inList(requestIds)}))` : `id = "none"`;
  const [stagedQuotes, quotes] = await Promise.all([
    apiRoot.stagedQuotes().get(q(fromRequests)).execute(),
    apiRoot.quotes().get(q(fromRequests)).execute(),
  ]);

  // Pending approvals of the personas' own orders, read as the approver (any unit member may read flows).
  const personaIds = new Set(Object.values(p.ids));
  const pendingApprovals = (
    await Promise.all(
      p.units.map(async (unitKey) => {
        const { body } = await asAssociate(p.ids.approver, unitKey)
          .approvalFlows()
          .get({ queryArgs: { where: `status = "Pending"`, expand: ["order"], limit: LIMIT } })
          .execute();
        return body.results
          .filter((f) => personaIds.has((f.order.obj as Order | undefined)?.customerId ?? ""))
          .map((f) => ({ id: f.id, version: f.version, unitKey }));
      }),
    )
  ).flat();

  const budgets = (
    await Promise.all(
      p.units.map((key) =>
        apiRoot
          .customObjects()
          .withContainerAndKey({ container: BUDGET_CONTAINER, key })
          .get()
          .execute()
          .then((r) => [{ key, version: r.body.version }])
          .catch((err) => (statusOf(err) === 404 ? [] : Promise.reject(err))),
      ),
    )
  ).flat();

  return {
    personas: p,
    input: {
      carts: refs(carts.body.results),
      quotes: refs(quotes.body.results),
      stagedQuotes: refs(stagedQuotes.body.results),
      quoteRequests: refs(quoteRequests.body.results),
      shoppingLists: refs(shoppingLists.body.results),
      recurringOrders: refs(recurringOrders.body.results),
      pendingApprovals,
      budgets,
    },
  };
}
