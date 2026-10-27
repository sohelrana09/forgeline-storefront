"use client";

import { useRouter } from "next/navigation";

// "Show [10] per page". Each option carries its own URL (built on the server), so the page size stays
// in the URL and the list is shareable.
export function PageSizeSelect({ value, options, label }: { value: number; options: { size: number; href: string }[]; label: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      Show
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          const option = options.find((o) => o.size === Number(e.target.value));
          if (option) router.push(option.href);
        }}
        className="min-h-11 rounded border border-gray-300 bg-white px-2"
      >
        {options.map((o) => (
          <option key={o.size} value={o.size}>
            {o.size}
          </option>
        ))}
      </select>
      per page
    </label>
  );
}
