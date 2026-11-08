"use client";

import { useActionState, useEffect, useState } from "react";
import { importPurchaseOrder } from "@/features/po-import/actions";
import type { PoImportState } from "@/features/po-import/types";
import { Message } from "@/components/ui/Message";

const MAX_PDF_BYTES = 5 * 1024 * 1024;

// "Read a purchase order": paste its text or upload its PDF; Claude lists the lines, which fill the quick-order box
// (`onLines`). The buyer checks them there and adds them with the usual button: nothing is added from here.
// Its own form, rendered before the quick-order form (forms can't nest).
export function PoImport({ onLines }: { onLines: (text: string) => void }) {
  const [state, action, pending] = useActionState(importPurchaseOrder, {} as PoImportState);
  const [fileError, setFileError] = useState<string>();
  useEffect(() => {
    if (state.text) onLines(state.text);
  }, [state, onLines]);

  return (
    <details className="rounded border border-gray-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Read a purchase order (PDF or text)</summary>
      <form action={action} className="mt-3 flex flex-col gap-2">
        <label htmlFor="po-file" className="text-xs font-semibold">
          Purchase order PDF (up to 5 MB)
        </label>
        <input
          id="po-file"
          name="po"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            setFileError(file && file.size > MAX_PDF_BYTES ? "The PDF is larger than 5 MB." : undefined);
          }}
          className="text-sm file:mr-3 file:min-h-9 file:rounded file:border file:border-gray-300 file:bg-white file:px-3 file:text-sm file:font-semibold"
        />
        <label htmlFor="po-text" className="text-xs font-semibold">
          Or paste its text
        </label>
        <textarea
          key={JSON.stringify(state)}
          defaultValue={state.poText}
          id="po-text"
          name="poText"
          rows={4}
          maxLength={20_000}
          className="resize-y rounded border border-gray-300 p-2.5 text-[13px]"
        />
        <p className="m-0 text-xs text-gray-600">
          Claude, an AI model, reads the part numbers and quantities into the order lines below. Check them before you add them. The
          document isn&apos;t stored.
        </p>
        <button
          disabled={pending || Boolean(fileError)}
          className="min-h-11 self-start rounded border border-gray-900 bg-white px-5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
        >
          {pending ? "Reading…" : "Read order lines"}
        </button>
        <div aria-live="polite" className="flex flex-col gap-2 text-sm">
          {fileError && <Message type="error">{fileError}</Message>}
          {state.error && <Message type="error">{state.error}</Message>}
          {state.count !== undefined && state.count > 0 && (
            <Message type="success">
              Read {state.count} {state.count === 1 ? "line" : "lines"} into the order lines. Check them, then add them to the cart.
            </Message>
          )}
          {state.unknown && state.unknown.length > 0 && (
            <Message type="warning">Not sold here: {state.unknown.join(", ")}. Correct or remove them before adding.</Message>
          )}
          {state.skipped && state.skipped.length > 0 && (
            <Message type="warning">
              Left out:
              <ul className="m-0 mt-1 list-disc pl-5">
                {state.skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Message>
          )}
        </div>
      </form>
    </details>
  );
}
