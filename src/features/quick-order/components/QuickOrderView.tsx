import { isRedirectError } from "next/dist/client/components/redirect-error";
import Image from "next/image";
import Link from "next/link";
import { apiRoot } from "@/lib/commercetools/client";
import { isQuoteOnly, localize, taxNote } from "@/features/catalog/utils";
import { QuickOrderForm } from "@/features/quick-order/components/QuickOrderForm";
import { getSession } from "@/features/auth/session";
import { listNames } from "@/features/purchase-lists/service";
import { PriceTag } from "@/features/catalog/components/PriceTag";
import { AddToCartForm } from "@/features/cart/components/AddToCartForm";
import type { BuyerContext } from "@/features/business-units/types";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 20;

export async function QuickOrderView({ context, page: requestedPage = 1 }: { context: BuyerContext; page?: number }) {
  // Up to the last page the API can serve (offset 10,000).
  const page = Math.min(Math.max(1, requestedPage), Math.floor(10_000 / PAGE_SIZE) + 1);
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        sort: ["name.en-US asc"],
        storeProjection: context.storeKey,
        priceCurrency: context.currency,
        priceChannel: context.channelId,
        ...(context.country && { priceCountry: context.country }),
      },
    })
    .execute();
  const note = taxNote(context.country);
  // Signed-in customers can send the pasted lines to a purchase list too.
  const session = context.guest ? undefined : await getSession();
  const lists = session ? await listNames(session, context).catch((err) => {
        if (isRedirectError(err)) throw err;
        return [];
      }) : undefined;
  const total = body.total ?? body.count;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <aside className="flex w-full flex-col gap-3 rounded-md border border-gray-200 bg-white p-5 md:max-w-sm md:flex-[1_1_300px]">
        <h1 className="m-0 text-lg font-semibold">Quick order</h1>
        {context.canOrder ? (
          <>
            <p className="m-0 text-sm text-gray-600">
              {context.guest
                ? "Lines go into your guest cart. Signing in moves them to your account's cart."
                : context.consumer
                  ? "Lines go into your cart."
                  : `Lines go into your ${context.businessUnitName} cart.`}
            </p>
            <QuickOrderForm lists={lists} />
          </>
        ) : (
          <p className="m-0 text-sm text-gray-600">
            You can browse {context.businessUnitName} prices, but only associates with the buyer role can order.
          </p>
        )}
      </aside>

      <section className="min-w-0 flex-[999_1_560px] rounded-md border border-gray-200 bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 px-5 py-4">
          <h2 className="m-0 text-xl font-semibold">
            Catalog <span className="text-base font-normal text-gray-600">· {first}–{last} of {total}</span>
          </h2>
          <span className="text-sm text-gray-600">
            {context.guest || context.consumer ? `List prices incl. VAT · ${context.storeName}` : `Prices for ${context.businessUnitName} · ${context.storeName}`}
          </span>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="px-5 py-2.5 font-semibold">Part</th>
                <th className="px-3 py-2.5 text-right font-semibold">Your price</th>
                <th className="px-5 py-2.5 font-semibold">
                  <span className="sr-only">Quantity and add to cart</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {body.results.map((product) => {
                const variant = product.masterVariant;
                const name = localize(product.name);
                const image = variant.images?.[0];
                const quoteOnly = isQuoteOnly(variant.price);
                return (
                  <tr key={product.id} className={`border-t border-gray-100 ${quoteOnly ? "bg-orange-50" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {image ? (
                          <Image src={image.url} alt="" width={44} height={44} className="h-11 w-11 flex-none rounded bg-gray-100 object-contain" />
                        ) : (
                          <div aria-hidden="true" className="h-11 w-11 flex-none rounded bg-gray-200" />
                        )}
                        <div className="min-w-0">
                          <Link href={`/p/${localize(product.slug)}`} className="font-semibold text-gray-900">
                            {name}
                          </Link>
                          <div className="font-mono text-xs text-gray-600">{variant.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <PriceTag price={variant.price} note={note} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        {variant.price && variant.sku && (
                          <AddToCartForm sku={variant.sku} name={name} canOrder={context.canOrder} canQuote={!context.consumer} quoteOnly={quoteOnly} size="row" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 p-3">
          <Pagination page={page} pages={pages} hrefFor={(p) => `/quick-order?page=${p}`} label="Catalog pages" />
        </div>
      </section>
    </div>
  );
}
