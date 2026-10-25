import type { ReactNode } from "react";

// One section of the one-step checkout (Magento: 1 Shipping Address, 2 Shipping Methods, 3 Payment Method).
// The numbers are the order the buyer fills them in; a later step says what it is waiting for until then.
export function CheckoutStep({ step, title, waitingFor, children }: { step: number; title: string; waitingFor?: string; children?: ReactNode }) {
  const headingId = `checkout-step-${step}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-5">
      <h2 id={headingId} className="m-0 flex items-center gap-3 border-b border-gray-200 pb-3 text-xl font-semibold">
        <span
          aria-hidden="true"
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${waitingFor ? "bg-gray-200 text-gray-600" : "bg-orange-700 text-white"}`}
        >
          {step}
        </span>
        {title}
      </h2>
      {waitingFor ? <p className="m-0 text-sm text-gray-600">{waitingFor}</p> : children}
    </section>
  );
}
