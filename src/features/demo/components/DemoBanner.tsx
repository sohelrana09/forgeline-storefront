import Link from "next/link";
import { demoSignInEnabled } from "@/features/demo/demo";

// DEMO_MODE: one line above the header on every page. The same for every visitor (only the environment is read), so
// it sits in the prerendered shell.
export function DemoBanner() {
  return (
    <div className="bg-gray-900 px-4 py-1.5 text-center text-xs text-gray-100">
      Demo store: no real orders, payments or deliveries; demo data resets every night.
      {demoSignInEnabled() && (
        <>
          {" "}
          <Link href="/login#demo" className="font-semibold text-white underline">
            Try as a buyer, approver or admin
          </Link>
        </>
      )}
    </div>
  );
}
