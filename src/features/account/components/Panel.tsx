import Link from "next/link";

type Action = { href: string; label: string };

// A titled account section holding side-by-side boxes (Magento's "block-dashboard-info" pattern).
export function Panel({ title, action, children }: { title: string; action?: Action; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-gray-200 bg-white">
      <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 px-5 py-4">
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        {action && (
          <Link href={action.href} className="text-sm text-orange-800">
            {action.label}
          </Link>
        )}
      </div>
      <div className="grid gap-6 p-5 text-sm sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function PanelBox({ title, action, children }: { title: string; action?: Action; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h3>
      <div className="flex flex-col gap-0.5">{children}</div>
      {action && (
        <Link href={action.href} className="mt-1 self-start text-orange-800">
          {action.label}
        </Link>
      )}
    </div>
  );
}
