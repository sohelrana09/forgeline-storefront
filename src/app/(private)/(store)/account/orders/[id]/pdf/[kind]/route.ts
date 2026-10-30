import { requireShopContext } from "@/features/business-units/context";
import { getOrderForViewer } from "@/features/orders/service";
import { DOCUMENT_KINDS, documentFilename, invoiceAvailable, orderDocument, type DocumentKind } from "@/features/orders/documents";
import { renderOrderPdf } from "@/features/orders/pdf";
import { approvalsForOrders } from "@/features/approvals/service";

// Order confirmation or invoice as a PDF download, for whoever may see the order (getOrderForViewer).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const [{ id, kind }, { session, context }] = await Promise.all([params, requireShopContext()]);
  if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) return new Response("Not found", { status: 404 });
  const order = await getOrderForViewer(session, context, id);
  if (!order) return new Response("Not found", { status: 404 });
  if (kind === "invoice") {
    const approval = (await approvalsForOrders(context, session.customerId, [order.id]))[order.id];
    if (!invoiceAvailable(order, approval?.status)) return new Response("No invoice for this order yet", { status: 404 });
  }
  const payment = order.paymentInfo?.payments.length ? "card" : order.businessUnit ? "invoice" : "bank-transfer";
  const pdf = await renderOrderPdf(
    orderDocument(order, kind as DocumentKind, { buyer: order.businessUnit ? context.businessUnitName : undefined, payment }),
  );
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${documentFilename(kind as DocumentKind, order)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
