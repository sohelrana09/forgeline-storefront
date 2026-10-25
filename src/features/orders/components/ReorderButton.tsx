import { reorder } from "@/features/orders/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

// Puts the order's lines back into the cart and opens it.
export function ReorderButton({ orderId, label, prominent = false }: { orderId: string; label?: string; prominent?: boolean }) {
  return (
    <form action={reorder}>
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton
        ariaLabel={label}
        className={
          prominent
            ? "min-h-11 rounded bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            : "min-h-11 px-1 text-orange-800 underline underline-offset-2 disabled:opacity-60"
        }
      >
        Reorder
      </SubmitButton>
    </form>
  );
}
