import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { ResetPasswordForm } from "@/features/auth/components/AccountForms";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="m-0 text-sm">
          This link is incomplete.{" "}
          <Link href="/forgot-password" className="text-orange-800">
            Request a new reset link
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
