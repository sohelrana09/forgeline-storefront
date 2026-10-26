import { AuthShell } from "@/features/auth/components/AuthShell";
import { VerifyEmailForm } from "@/features/auth/components/AccountForms";

export const dynamic = "force-dynamic";

// Opening the link doesn't confirm anything: email scanners open links too, and the token works only once.
// The customer confirms with the button.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Confirm your email address">
      {token ? (
        <VerifyEmailForm token={token} />
      ) : (
        <p className="m-0 text-sm">This link is incomplete. Request a new one from your account.</p>
      )}
    </AuthShell>
  );
}
