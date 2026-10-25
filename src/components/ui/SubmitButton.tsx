"use client";

import { useFormStatus } from "react-dom";

// Disabled while its form's Server Action runs, so a double-click can't create two carts.
export function SubmitButton({ children, className, ariaLabel }: { children: React.ReactNode; className?: string; ariaLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className} aria-label={ariaLabel}>
      {pending ? "…" : children}
    </button>
  );
}
