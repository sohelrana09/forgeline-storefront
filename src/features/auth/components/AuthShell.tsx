// Customer pages inside the shop layout (Magento "Customer Login", "Create New Customer Account"): page title, then
// the form in a white panel. `aside` adds a second column (the login page's "New customers" box).
// A single panel (sign-up, password pages) is centred on the page, title included.
export function AuthShell({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-6 ${aside ? "" : "mx-auto w-full max-w-xl"}`}>
      <h1 className={`m-0 text-3xl font-bold ${aside ? "" : "text-center"}`}>{title}</h1>
      <div className={`grid items-start gap-6 ${aside ? "md:grid-cols-2" : ""}`}>
        <section className="rounded-md border border-gray-200 bg-white p-6">{children}</section>
        {aside && <section className="rounded-md border border-gray-200 bg-white p-6">{aside}</section>}
      </div>
    </div>
  );
}
