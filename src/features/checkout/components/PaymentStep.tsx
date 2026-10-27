import { CheckoutStep } from "@/features/checkout/components/CheckoutStep";
import { PlaceOrderForm } from "@/features/checkout/components/CheckoutForm";
import { BankTransferForm } from "@/features/checkout/components/BankTransferForm";
import { CardPayment } from "@/features/checkout/components/CardPayment";

export type PaymentKind = "invoice" | "bank-transfer" | "card";

const METHODS: Record<PaymentKind, { title: string; description: string }> = {
  invoice: {
    title: "Purchase order (pay on invoice)",
    description: "Invoiced to your company under your payment terms.",
  },
  "bank-transfer": {
    title: "Bank transfer",
    description: "Your order confirmation shows our bank details and the reference to use. We ship once the payment arrives.",
  },
  card: {
    title: "Credit or debit card",
    description: "Handled by commercetools Checkout. We never see your card number.",
  },
};

// Step 3 of the one-step checkout (Payment Method): the payment method for this kind of customer, the
// billing address, then Place order. Each customer kind has one method, shown selected.
export function PaymentStep({
  kind,
  billing,
  cartVersion,
  purchaseOrderNumber,
  ready,
  waitingFor,
}: {
  kind: PaymentKind;
  billing: string;
  cartVersion: number;
  purchaseOrderNumber?: string;
  ready: boolean;
  waitingFor?: string;
}) {
  const method = METHODS[kind];
  return (
    <CheckoutStep step={3} title="Payment method" waitingFor={waitingFor}>
      <div className="flex flex-col gap-4">
        <div className="rounded border-2 border-orange-700 bg-orange-50 p-4">
          <p className="m-0 flex items-center gap-3 font-semibold">
            <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border-2 border-orange-700">
              <span className="size-2 rounded-full bg-orange-700" />
            </span>
            {method.title}
          </p>
          <p className="m-0 mt-1 pl-7 text-sm text-gray-700">{method.description}</p>
        </div>
        <div className="text-sm">
          <p className="m-0 font-semibold">Billing address</p>
          <p className="m-0 whitespace-pre-line text-gray-700">{billing}</p>
        </div>
        {kind === "invoice" ? (
          <PlaceOrderForm cartVersion={cartVersion} purchaseOrderNumber={purchaseOrderNumber} ready={ready} />
        ) : kind === "card" ? (
          <CardPayment cartVersion={cartVersion} ready={ready} />
        ) : (
          <BankTransferForm cartVersion={cartVersion} ready={ready} />
        )}
      </div>
    </CheckoutStep>
  );
}
