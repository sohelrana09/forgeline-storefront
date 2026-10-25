import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getInvitation } from "@/features/company/service";
import { AcceptInvitationForm } from "@/features/company/components/CompanyForms";
import type { Session } from "@/features/auth/session";

// An invitation to join a company (sent from the company's Users page). Only the invited account sees its details.
export async function InvitationView({ session, code }: { session: Session; code: string }) {
  const invite = await getInvitation(code, session.customerId);
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: "My account", href: "/account" }, { label: "Company invitation" }]} />
      <h1 className="m-0 text-2xl font-bold">Company invitation</h1>
      {invite ? (
        <section className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-5">
          <p className="m-0">
            You are invited to join <strong>{invite.unitName}</strong> as {invite.roleNames.join(", ")}.
          </p>
          <p className="m-0 text-sm text-gray-600">
            You will see the company&apos;s prices and buy for it in the company switcher. Your personal account stays as it is.
          </p>
          <AcceptInvitationForm code={code} />
        </section>
      ) : (
        <p role="alert" className="m-0 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          This invitation has expired, was already used, or is for another account. You are signed in as {session.email}.{" "}
          <Link href="/account" className="font-semibold text-amber-950">
            Go to my account
          </Link>
        </p>
      )}
    </div>
  );
}
