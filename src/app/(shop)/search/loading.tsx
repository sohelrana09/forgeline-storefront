import { PageSkeleton } from "@/components/ui/PageSkeleton";

// The page reads the visitor's cookies and the URL, so its content streams in behind this skeleton; the header and
// footer around it are the prerendered shell.
export default function Loading() {
  return <PageSkeleton />;
}
