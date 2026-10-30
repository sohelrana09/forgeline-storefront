// A file download styled as the site's secondary button (white, gray border, same 44 px height as the primary one),
// with a download icon and the file type as a quiet badge. A plain <a>: it fetches a file, not a page. `shortLabel`
// replaces the label on phones; `block` stretches the button to its column.
export function DownloadButton({
  href,
  label,
  shortLabel,
  fileType,
  size = "md",
  block = false,
}: {
  href: string;
  label: string;
  shortLabel?: string;
  fileType: string;
  size?: "sm" | "md";
  block?: boolean;
}) {
  return (
    <a
      href={href}
      download
      aria-label={`Download ${label} (${fileType})`}
      className={`items-center justify-center gap-2 rounded border border-gray-300 bg-white font-semibold text-gray-800 no-underline hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 ${
        block ? "flex w-full sm:inline-flex sm:w-auto" : "inline-flex"
      } ${size === "sm" ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-sm"}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 flex-none text-gray-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {shortLabel ? (
        <>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">{fileType}</span>
    </a>
  );
}
