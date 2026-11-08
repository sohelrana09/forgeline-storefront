import { ProductGridSkeleton } from "@/components/ui/Skeletons";

// The page reads the visitor's cookies and the URL, so its content streams in behind this skeleton (its own layout).
export default function Loading() {
  return <ProductGridSkeleton />;
}
