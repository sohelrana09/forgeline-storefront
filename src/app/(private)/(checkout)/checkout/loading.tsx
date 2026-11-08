import { CheckoutSkeleton } from "@/components/ui/Skeletons";

// Skeleton while checkout loads (the header stays): steps 1-3 and the order summary, as on the page.
export default function CheckoutLoading() {
  return <CheckoutSkeleton />;
}
