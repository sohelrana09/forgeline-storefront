import type { Quote, QuoteRequest } from "@commercetools/platform-sdk";
import type { Tone } from "@/features/quotes/types";

export const QUOTE_REQUEST_STATES: Record<string, { label: string; tone: Tone }> = {
  Submitted: { label: "Submitted", tone: "info" },
  Accepted: { label: "Quoted", tone: "success" },
  Closed: { label: "Closed", tone: "neutral" },
  Rejected: { label: "Rejected", tone: "danger" },
  Cancelled: { label: "Cancelled", tone: "neutral" },
};

export const QUOTE_STATES: Record<string, { label: string; tone: Tone }> = {
  Pending: { label: "Awaiting your decision", tone: "warning" },
  Accepted: { label: "Accepted", tone: "success" },
  Declined: { label: "Declined", tone: "neutral" },
  DeclinedForRenegotiation: { label: "Renegotiation requested", tone: "info" },
  RenegotiationAddressed: { label: "Replaced by a new quote", tone: "neutral" },
  Withdrawn: { label: "Withdrawn by seller", tone: "neutral" },
};

export const isExpired = (quote: Pick<Quote, "validTo">) => Boolean(quote.validTo && new Date(quote.validTo) <= new Date());

// Only a Pending, unexpired quote can be declined, renegotiated or ordered.
export const isActionable = (quote: Pick<Quote, "quoteState" | "validTo">) => quote.quoteState === "Pending" && !isExpired(quote);

export const canCancelRequest = (request: Pick<QuoteRequest, "quoteRequestState">) => request.quoteRequestState === "Submitted";

export const shortRef = (item: { key?: string; id: string }) => item.key ?? item.id.slice(0, 8).toUpperCase();

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const COMMENT_MAX = 1000;
export const PO_PATTERN = /^[A-Za-z0-9 ._/#-]{1,35}$/;
