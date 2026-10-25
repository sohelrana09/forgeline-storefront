"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Lets step 3 know that steps 1-2 are saving or hold unsaved edits, so Place order waits for them instead of ordering
// with the previous address or failing on a changed cart version.
type Status = { busy: boolean; report: (source: string, busy: boolean) => void };
const CheckoutStatusContext = createContext<Status>({ busy: false, report: () => {} });

export function CheckoutStatusProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Record<string, boolean>>({});
  // Stable, so reporters' effects don't re-run on every render.
  const report = useCallback((source: string, busy: boolean) => setSources((s) => (s[source] === busy ? s : { ...s, [source]: busy })), []);
  const busy = Object.values(sources).some(Boolean);
  const value = useMemo(() => ({ busy, report }), [busy, report]);
  return <CheckoutStatusContext.Provider value={value}>{children}</CheckoutStatusContext.Provider>;
}

export const useCheckoutBusy = () => useContext(CheckoutStatusContext).busy;

// Reports one source's state (e.g. "delivery" while saving) for as long as the component is mounted.
export function useReportBusy(source: string, busy: boolean) {
  const { report } = useContext(CheckoutStatusContext);
  useEffect(() => {
    report(source, busy);
    return () => report(source, false);
  }, [source, busy, report]);
}
