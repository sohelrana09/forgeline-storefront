import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { punchoutEnabled } from "@/features/punchout/config";
import { PunchoutView } from "@/features/punchout/components/PunchoutView";

export const metadata: Metadata = { title: "PunchOut", robots: { index: false, follow: false } };

export default async function PunchoutPage() {
  if (!punchoutEnabled()) notFound();
  return <PunchoutView />;
}
