import { getMe } from "@/features/account/service";
import { AccountInformationForm } from "@/features/account/components/AccountInformationForm";
import { ChangePasswordForm } from "@/features/account/components/ChangePasswordForm";
import type { Session } from "@/features/auth/session";

export async function AccountInformationView({ session }: { session: Session }) {
  const me = await getMe(session);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-2xl font-bold">Account information</h1>
      <section aria-label="Contact information" className="rounded-md border border-gray-200 bg-white p-5">
        <AccountInformationForm firstName={me.firstName ?? ""} lastName={me.lastName ?? ""} email={me.email} />
      </section>
      <section aria-label="Change password" className="rounded-md border border-gray-200 bg-white p-5">
        <h2 className="mt-0 mb-4 text-lg font-bold">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
