"use client";

import { useActionState } from "react";
import { acceptInvitationAction, addUser, changeUserRoles, removeUser, saveCompanyProfile } from "@/features/company/actions";
import type { CompanyActionState } from "@/features/company/types";

const initial: CompanyActionState = {};
const field = "min-h-11 w-full rounded border border-gray-300 px-3 text-base";
const primary = "min-h-11 rounded bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800 disabled:opacity-60";

function Notice({ state }: { state: CompanyActionState }) {
  if (state.error)
    return (
      <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        {state.error}
      </p>
    );
  if (state.saved)
    return (
      <p role="status" className="m-0 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
        {state.saved}
      </p>
    );
  return null;
}

type Role = { key: string; name: string };

function RoleChoices({ roles, selected, idPrefix }: { roles: Role[]; selected: string[]; idPrefix: string }) {
  return (
    <fieldset className="m-0 flex flex-wrap gap-x-5 gap-y-1 border-0 p-0">
      <legend className="sr-only">Roles</legend>
      {roles.map((r) => (
        <label key={r.key} htmlFor={`${idPrefix}-${r.key}`} className="flex min-h-11 items-center gap-2 text-sm">
          <input
            id={`${idPrefix}-${r.key}`}
            type="checkbox"
            name="roles"
            value={r.key}
            defaultChecked={selected.includes(r.key)}
            className="h-5 w-5"
          />
          {r.name}
        </label>
      ))}
    </fieldset>
  );
}

export function CompanyProfileForm({ name, contactEmail }: { name: string; contactEmail?: string }) {
  const [state, action, pending] = useActionState(saveCompanyProfile, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <Notice state={state} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Company name
        <input name="name" defaultValue={name} required minLength={2} maxLength={100} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Contact email
        <input name="contactEmail" type="email" defaultValue={contactEmail} maxLength={254} className={field} />
      </label>
      <button disabled={pending} className={`${primary} self-start`}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function AddUserForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(addUser, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Notice state={state} />
      <label className="flex max-w-md flex-col gap-1 text-sm font-semibold">
        Email of an existing customer account
        <input name="email" type="email" required maxLength={254} autoComplete="off" className={field} />
      </label>
      <RoleChoices roles={roles} selected={["buyer"]} idPrefix="new" />
      <button disabled={pending} className={`${primary} self-start`}>
        {pending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}

export function UserRolesForm({
  customerId,
  name,
  roles,
  selected,
}: {
  customerId: string;
  name: string;
  roles: Role[];
  selected: string[];
}) {
  const [state, action, pending] = useActionState(changeUserRoles, initial);
  const [removeState, removeAction, removing] = useActionState(removeUser, initial);
  return (
    <div className="flex flex-col gap-2">
      <form action={action} aria-label={`Roles for ${name}`} className="flex flex-wrap items-center gap-x-4">
        <input type="hidden" name="customerId" value={customerId} />
        <RoleChoices roles={roles} selected={selected} idPrefix={customerId} />
        <button
          disabled={pending || removing}
          className="min-h-11 rounded border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save roles"}
        </button>
      </form>
      <form
        action={removeAction}
        onSubmit={(e) => {
          if (!window.confirm(`Remove ${name} from the company? They will lose access to its prices, carts and orders.`))
            e.preventDefault();
        }}
      >
        <input type="hidden" name="customerId" value={customerId} />
        <button
          disabled={pending || removing}
          className="min-h-11 px-1 text-sm text-red-800 underline underline-offset-2 disabled:opacity-60"
        >
          {removing ? "Removing…" : `Remove ${name}`}
        </button>
      </form>
      <Notice state={state.error || state.saved ? state : removeState} />
    </div>
  );
}

export function AcceptInvitationForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <Notice state={state} />
      <button disabled={pending} className={`${primary} self-start`}>
        {pending ? "Joining…" : "Accept invitation"}
      </button>
    </form>
  );
}
