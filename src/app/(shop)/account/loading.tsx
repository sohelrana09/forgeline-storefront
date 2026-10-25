// Shown inside the account layout while a section loads: the sidebar stays put and answers clicks at once.
export default function AccountLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-48 rounded bg-gray-200" />
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-5">
          <div className="h-5 w-40 rounded bg-gray-200" />
          {Array.from({ length: 4 }, (_, j) => (
            <div key={j} className="h-4 w-full rounded bg-gray-100" />
          ))}
        </div>
      ))}
    </div>
  );
}
