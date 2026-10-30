import Link from "next/link";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { ForgotPasswordForm } from "@/features/auth/components/AccountForms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password">
      <p className="mb-4 mt-0 text-sm text-gray-700">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
      <p className="mb-0 mt-5 text-sm">
        <Link href="/login" className="text-orange-800">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
