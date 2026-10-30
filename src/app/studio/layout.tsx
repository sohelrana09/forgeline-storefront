import { RootDocument } from "@/app/_components/RootDocument";

// The embedded Sanity Studio's own root layout: no store chrome, a fixed CSP (src/proxy.ts).
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument>{children}</RootDocument>;
}
