import Image from "next/image";
import Link from "next/link";
import { getActiveCart, type CartAuth } from "@/features/cart/service";
import { isQuoteOnly, localize } from "@/features/catalog/utils";
import { formatMoney } from "@/lib/utils";
import { AddToListPanel } from "@/features/purchase-lists/components/AddToListPanel";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { RequestQuoteForm } from "@/features/quotes/components/RequestQuoteForm";
import { CmsBlocks } from "@/features/cms/components/CmsBlocks";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { updateCartLine } from "@/features/cart/actions";
import type { BuyerContext } from "@/features/business-units/types";
import { productHref } from "@/features/catalog/utils";
import { categoryPath } from "@/lib/urls";

// After sign-in, the guest cart's lines were added here: ?merged=<count>&skipped=<skus not sold to this unit>.
type MergeNotice = { merged?: string; skipped?: string };

function MergeBanner({ merge, context }: { merge: MergeNotice; context: BuyerContext }) {
  const merged = Number(merge.merged);
  const skipped = (merge.skipped ?? "").split(",").filter((s) => /^[A-Za-z0-9._-]+$/.test(s));
  if (!(merged > 0) && skipped.length === 0) return null;
  return (
    <div role="status" className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-950">
      {merged > 0 && (
        <p className="m-0">
          {merged === 1 ? "1 line" : `${merged} lines`} from your guest cart {merged === 1 ? "was" : "were"} added to your{" "}
          {context.consumer ? "cart" : `${context.businessUnitName} cart, at your company prices`}.
        </p>
      )}
      {skipped.length > 0 && (
        <p className="m-0 mt-1 text-orange-900">
          {context.consumer ? "Sold to business customers only, so not added" : `Not available for ${context.businessUnitName}`}:{" "}
          <span className="font-mono">{skipped.join(", ")}</span>
        </p>
      )}
    </div>
  );
}

const signInToContinue = (what: string) => (
  <Link href="/login" className="rounded bg-orange-700 px-5 py-3 text-center font-semibold text-white no-underline hover:bg-orange-800">
    Sign in to {what}
  </Link>
);

export async function CartView({
  auth,
  context,
  cartId,
  merge = {},
}: {
  auth?: CartAuth;
  context: BuyerContext;
  cartId?: string;
  merge?: MergeNotice;
}) {
  const cart = auth && (await getActiveCart(auth, cartId, context));

  if (!cart || cart.lineItems.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-md border border-gray-200 bg-white p-8">
        <MergeBanner merge={merge} context={context} />
        <h1 className="m-0 text-2xl font-bold">Your cart is empty</h1>
        <p className="m-0 text-gray-600">
          {context.guest
            ? "Lines you add appear here. Signing in moves them to your account's cart."
            : context.consumer
              ? "Products you add appear here."
              : `Lines you add for ${context.businessUnitName} appear here.`}
        </p>
        <div className="flex gap-3">
          <Link href={categoryPath(["spare_parts"])} className="rounded bg-orange-700 px-5 py-3 font-semibold text-white no-underline">
            Shop spare parts
          </Link>
          <Link href="/quick-order" className="rounded border border-gray-300 px-5 py-3 font-semibold text-gray-800 no-underline">
            Order by SKU
          </Link>
        </div>
      </div>
    );
  }

  const quoteLines = cart.lineItems.filter((l) => isQuoteOnly(l.price));
  const ship = cart.shippingAddress;

  return (
    <div className="flex flex-col gap-6">
      <MergeBanner merge={merge} context={context} />
      <h1 className="m-0 text-2xl font-bold">{context.guest || context.consumer ? "Cart" : `Cart · ${context.businessUnitName}`}</h1>
      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Cart lines" className="min-w-0 flex-[999_1_560px] rounded-md border border-gray-200 bg-white">
          <ul className="m-0 list-none p-0">
            {cart.lineItems.map((line) => {
              const name = localize(line.name);
              const image = line.variant.images?.[0];
              const unit = line.price.discounted?.value ?? line.price.value;
              return (
                <li key={line.id} className="flex flex-wrap items-center gap-4 border-b border-gray-100 p-4 last:border-b-0">
                  {image ? (
                    <Image
                      src={image.url}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 flex-none rounded bg-gray-50 object-contain"
                    />
                  ) : (
                    <div aria-hidden="true" className="h-16 w-16 flex-none rounded bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={productHref(line.productSlug, line.variant.sku)} className="font-semibold text-gray-900">
                      {name}
                    </Link>
                    <div className="font-mono text-xs text-gray-600">{line.variant.sku}</div>
                    <div className="text-sm text-gray-600">{formatMoney(unit)} each</div>
                    {isQuoteOnly(line.price) && <div className="text-sm font-semibold text-orange-800">Priced on quote</div>}
                  </div>
                  {context.canOrder && (
                    <form action={updateCartLine} className="flex items-center gap-2">
                      <input type="hidden" name="lineItemId" value={line.id} />
                      <QuantityInput
                        name="quantity"
                        defaultValue={line.quantity}
                        // Re-mount when the server quantity changes, so the field never shows a stale value.
                        key={`${line.id}-${line.quantity}`}
                        label={`quantity for ${name}`}
                        className="w-32"
                      />
                      <SubmitButton className="min-h-11 rounded border border-gray-300 bg-white px-3 text-sm disabled:opacity-60">
                        Update
                      </SubmitButton>
                      <button
                        name="intent"
                        value="remove"
                        aria-label={`Remove ${name}`}
                        className="min-h-11 rounded px-3 text-sm text-red-800 underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                  <div className="w-28 text-right font-semibold">{formatMoney(line.totalPrice)}</div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex w-full flex-col gap-4 md:max-w-sm md:flex-[1_1_300px]">
          <CartSummary cart={cart} />
          <AddToListPanel context={context} kind="cart" />
          {ship && (
            <p className="m-0 text-sm text-gray-600">
              Ships to{" "}
              {[ship.company, ship.streetName && `${ship.streetName} ${ship.streetNumber ?? ""}`.trim(), ship.city, ship.country]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {context.guest && quoteLines.length > 0 ? (
            // Machines are sold to business customers on quote: they sign in to request one.
            <>
              {signInToContinue("request a quote")}
              <p className="m-0 text-sm text-gray-600">
                Machines are sold to business customers on quote. Your lines move to your company cart when you sign in.
              </p>
            </>
          ) : context.guest ? (
            // Guests check out with their email and pay by card, or sign in to use their account.
            <>
              <Link
                href="/checkout"
                className="rounded bg-orange-700 px-5 py-3 text-center font-semibold text-white no-underline hover:bg-orange-800"
              >
                Check out as guest
              </Link>
              <Link
                href="/login"
                className="rounded border border-gray-300 bg-white px-5 py-3 text-center font-semibold text-gray-800 no-underline hover:bg-gray-50"
              >
                Sign in to check out
              </Link>
              <p className="m-0 text-sm text-gray-600">
                Signing in moves these lines to your account. Business customers see their company prices.
              </p>
            </>
          ) : context.consumer && quoteLines.length > 0 ? (
            // Consumers can't request quotes: machines must leave the cart before checkout.
            <p role="alert" className="m-0 rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
              {quoteLines.length === 1 ? "One item is" : `${quoteLines.length} items are`} sold to business customers on quote. Remove{" "}
              {quoteLines.length === 1 ? "it" : "them"} to check out.
            </p>
          ) : !context.canOrder ? (
            <p className="m-0 text-sm text-gray-600">Only associates with the buyer role can check out or request quotes.</p>
          ) : quoteLines.length > 0 ? (
            // Machines are priced by quote: the whole cart goes to sales as a quote request instead of checkout.
            <section aria-labelledby="request-quote" className="flex flex-col gap-3 rounded-md border border-orange-200 bg-orange-50 p-4">
              <h2 id="request-quote" className="m-0 text-lg font-semibold text-orange-950">
                Request a quote
              </h2>
              <p className="m-0 text-sm text-orange-950">
                {quoteLines.length === 1 ? "One line is" : `${quoteLines.length} lines are`} priced on quote. Our sales team will reply with
                a quote for the whole cart that you can accept online.
              </p>
              <RequestQuoteForm cartVersion={cart.version} primary />
            </section>
          ) : (
            <>
              <Link
                href="/checkout"
                className="rounded bg-orange-700 px-5 py-3 text-center font-semibold text-white no-underline hover:bg-orange-800"
              >
                Checkout
              </Link>
              <details className="rounded-md border border-gray-200 bg-white p-4">
                <summary className="text-sm font-semibold">Need a custom price? Request a quote instead</summary>
                <div className="mt-3">
                  <RequestQuoteForm cartVersion={cart.version} primary={false} />
                </div>
              </details>
            </>
          )}
          <CmsBlocks placement="cart.sidebar" context={context} />
        </div>
      </div>
    </div>
  );
}
