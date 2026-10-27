import type { Tone } from "@/components/ui/StateBadge";

// Customer-facing wording for approval states.
export const APPROVAL_STATES: Record<string, { label: string; tone: Tone }> = {
  Pending: { label: "Pending approval", tone: "warning" },
  Approved: { label: "Approved", tone: "success" },
  Rejected: { label: "Rejected", tone: "danger" },
};

export const REASON_MAX = 256;
