import type { Metadata } from "next";
import { logout } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { AuthShell } from "@/features/auth/components/AuthShell";

export const metadata: Metadata = { title: "No access" };

// A business associate whose unit can't be shopped right now (e.g. its store has no price channel). They are
// never switched to consumer prices silently; our sales team has to fix the unit.
export default async function NoAccess() {
  const session = await getSession();
  return (
    <AuthShell title="Your company account isn't ready">
      <p className="mb-4 mt-0 text-sm text-gray-700">
        {session?.email ?? "This account"} belongs to a company account that can&apos;t place orders online yet. Please contact our sales
        team.
      </p>
      <form action={logout}>
        <button className="min-h-11 rounded bg-gray-900 px-4 text-sm font-semibold text-white">Sign out</button>
      </form>
    </AuthShell>
  );
}
