import { CartSkeleton } from "@/components/ui/Skeletons";

// Skeleton while the cart loads (the header stays), in the cart's layout: lines and summary.
export default function CartLoading() {
  return <CartSkeleton />;
}
