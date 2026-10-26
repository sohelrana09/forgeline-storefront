"use client";

import { useEffect, useRef } from "react";

// Inside a public form: a honeypot field people never see (bots fill every field) and how long the form was open,
// written just before it is sent. The server refuses filled honeypots and forms sent within 1.5 seconds
// (isAutomated in src/lib/bot-check.ts). The names must match HONEYPOT_FIELD and ELAPSED_FIELD there.
export function FormGuardFields() {
  const elapsed = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const start = performance.now();
    const input = elapsed.current;
    const form = input?.form;
    if (!input || !form) return;
    // Capture phase: runs before React reads the form for its action.
    const stamp = () => {
      input.value = String(Math.round(performance.now() - start));
    };
    form.addEventListener("submit", stamp, true);
    return () => form.removeEventListener("submit", stamp, true);
  }, []);
  return (
    <>
      <input ref={elapsed} type="hidden" name="form_elapsed" defaultValue="" />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}
