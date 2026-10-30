"use client";

import { useActionState, useRef, useState } from "react";
import { csvToLines } from "@/features/quick-order/csv";
import { quickOrder } from "@/features/quick-order/actions";
import { addQuickOrderToListAction } from "@/features/purchase-lists/actions";
import { ListResult, ListTargetFields } from "@/features/purchase-lists/components/AddToListForm";
import type { ListActionState } from "@/features/purchase-lists/types";
import type { QuickOrderState } from "@/features/quick-order/types";
import { Message } from "@/components/ui/Message";

const initial: QuickOrderState = { added: [], errors: [] };
const MAX_UPLOAD_BYTES = 1024 * 1024;

type Upload = { file: string; lines: number; skipped: number; columns?: string } | { file: string; error: string };

// `lists`: the signed-in customer's purchase lists; the pasted lines can go to one of them instead of the cart.
export function QuickOrderForm({ lists }: { lists?: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(quickOrder, initial);
  const [listState, listAction, listPending] = useActionState(addQuickOrderToListAction, {} as ListActionState);
  const listButton = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [upload, setUpload] = useState<Upload>();
  const lineCount = state.added.length;

  // A spreadsheet fills the box (read here, in the browser); the buyer checks the lines, then adds them to the cart or
  // a list, where they are validated like typed lines.
  async function readSpreadsheet(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ""; // the same file can be chosen again after editing it
    if (!file || !box.current) return;
    if (/\.(xlsx?|ods|numbers)$/i.test(file.name))
      return setUpload({ file: file.name, error: "Save the spreadsheet as CSV (File → Save as → CSV) and upload that file." });
    if (file.size > MAX_UPLOAD_BYTES) return setUpload({ file: file.name, error: "The file is larger than 1 MB." });
    const { lines, skipped, columns } = csvToLines(await file.text());
    if (lines.length === 0) return setUpload({ file: file.name, error: "No SKUs found in the file." });
    box.current.value = lines.join("\n");
    setUpload({
      file: file.name,
      lines: lines.length,
      skipped,
      columns: columns && [columns.sku, columns.quantity].filter(Boolean).join(" and "),
    });
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 rounded border border-dashed border-gray-300 p-3">
        <label htmlFor="qo-file" className="text-xs font-semibold">
          Upload a spreadsheet (CSV)
        </label>
        <input
          id="qo-file"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          onChange={(e) => readSpreadsheet(e.currentTarget)}
          className="text-sm file:mr-3 file:min-h-9 file:rounded file:border file:border-gray-300 file:bg-white file:px-3 file:text-sm file:font-semibold"
          aria-describedby="qo-file-help qo-upload"
        />
        <p id="qo-file-help" className="m-0 text-xs text-gray-600">
          Columns SKU and Quantity (other columns are ignored).{" "}
          <a href="/quick-order-template.csv" download className="text-orange-800">
            Download a template
          </a>
        </p>
        <div id="qo-upload" aria-live="polite" className="text-sm">
          {upload &&
            ("error" in upload ? (
              <Message type="error">
                {upload.file}: {upload.error}
              </Message>
            ) : (
              <Message type="success">
                Loaded {upload.lines} {upload.lines === 1 ? "line" : "lines"} from {upload.file}
                {upload.columns && ` (columns ${upload.columns})`}
                {upload.skipped > 0 && `, skipped ${upload.skipped} ${upload.skipped === 1 ? "row" : "rows"} without a SKU`}. Check them
                below, then add them to the cart or a purchase list.
              </Message>
            ))}
        </div>
      </div>
      <label htmlFor="qo-lines" className="text-xs font-semibold">
        Order lines
      </label>
      <textarea
        // Re-mount after each submit so the box shows only the lines that still need fixing.
        key={JSON.stringify(state)}
        ref={box}
        id="qo-lines"
        name="lines"
        rows={7}
        defaultValue={state.submitted ?? "air-filter, 24\noil-filter, 24\nhydraulic-hose, 6\nfuel-filter, 12"}
        className="resize-y rounded border border-gray-300 p-2.5 font-mono text-[13px]"
        aria-describedby="qo-help qo-result"
      />
      <p id="qo-help" className="m-0 text-xs text-gray-600">
        One line per item: SKU, quantity. Duplicate SKUs are combined.
      </p>
      <button disabled={pending} className="min-h-11 rounded bg-orange-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add all to cart"}
      </button>
      {lists && (
        <details
          className="rounded border border-gray-200 p-3"
          // Enter in the list fields submits to the list; the form's default button would add to the cart.
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
              e.preventDefault();
              listButton.current?.form?.requestSubmit(listButton.current);
            }
          }}
        >
          <summary className="cursor-pointer text-sm font-semibold">Add these lines to a purchase list</summary>
          <div className="mt-3 flex flex-col gap-3">
            <ListTargetFields key={lists.map((l) => l.id).join()} lists={lists} idPrefix="qo-to-list" nameRequired={false} />
            <ListResult state={listState} />
            <button
              ref={listButton}
              formAction={listAction}
              disabled={listPending}
              className="min-h-11 self-start rounded border border-gray-900 bg-white px-5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
            >
              {listPending ? "Saving…" : "Add to purchase list"}
            </button>
          </div>
        </details>
      )}

      <div id="qo-result" aria-live="polite" className="flex flex-col gap-2 text-sm">
        {lineCount > 0 && (
          <Message type="success">
            Added {lineCount} {lineCount === 1 ? "line" : "lines"} to the cart:
            <ul className="m-0 mt-1 list-none p-0">
              {state.added.map((l) => (
                <li key={l.sku}>
                  {l.quantity} × {l.name} <span className="font-mono text-xs">({l.sku})</span>
                </li>
              ))}
            </ul>
          </Message>
        )}
        {state.errors.length > 0 && (
          <Message type="error">
            <strong>Not added:</strong>
            <ul className="m-0 mt-1 list-none p-0">
              {state.errors.map((e, i) => (
                <li key={i}>
                  {e.line > 0 && `Line ${e.line}: `}
                  {e.text && <span className="font-mono text-xs">{e.text}</span>} {e.reason}
                </li>
              ))}
            </ul>
          </Message>
        )}
      </div>
    </form>
  );
}
