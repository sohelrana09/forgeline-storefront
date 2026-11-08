"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/PageMessages";
import { submitReviewAction, type ReviewFormState } from "@/features/reviews/actions";

const field = "min-h-11 rounded border border-gray-300 px-3";

export function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(submitReviewAction, {} as ReviewFormState);
  if (state.saved) return <FormMessage state={state} success={state.saved} />;
  return (
    <form action={action} className="flex flex-col gap-3 text-sm">
      <FormMessage state={state} error={state.error} />
      <input type="hidden" name="productId" value={productId} />
      <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0">
        <legend className="mb-1 font-semibold">Your rating</legend>
        {[5, 4, 3, 2, 1].map((n) => (
          <label key={n} className="flex min-h-9 items-center gap-1">
            <input type="radio" name="rating" value={n} required />
            {n} {n === 1 ? "star" : "stars"}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 font-semibold">
        Title (optional)
        <input name="title" maxLength={100} className={`${field} font-normal`} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Your review
        <textarea
          name="text"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="rounded border border-gray-300 px-3 py-2 font-normal"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded bg-orange-700 px-5 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send review"}
      </button>
    </form>
  );
}
