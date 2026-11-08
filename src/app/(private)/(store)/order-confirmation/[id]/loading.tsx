import { OrderConfirmationSkeleton } from "@/components/ui/Skeletons";

// Skeleton while the order confirmation loads (the header stays), in its layout.
export default function OrderConfirmationLoading() {
  return <OrderConfirmationSkeleton />;
}
