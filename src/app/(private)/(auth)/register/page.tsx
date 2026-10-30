import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { RegisterForm } from "@/features/auth/components/AccountForms";

export default async function RegisterPage() {
  if (await getSession()) redirect("/account");
  return (
    <AuthShell title="Create new customer account">
      <RegisterForm />
      <p className="mb-0 mt-5 text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-orange-800">
          Sign in
        </Link>
      </p>
      <p className="mb-0 mt-2 text-xs text-gray-600">Buying for a company? Our sales team sets up business accounts with company prices.</p>
    </AuthShell>
  );
}
