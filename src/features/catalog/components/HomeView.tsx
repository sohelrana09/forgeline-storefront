import Image from "next/image";
import Link from "next/link";
import { getCategoryTiles, getCategoryTree, getProductsInCategories } from "@/features/catalog/service";
import { taxNote } from "@/features/catalog/utils";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { Carousel } from "@/components/ui/Carousel";
import { CmsBlocks } from "@/features/cms/components/CmsBlocks";
import { HeroBanners } from "@/features/cms/components/HeroBanners";
import { getBlocks } from "@/features/cms/service";
import { validBanners } from "@/features/cms/utils";
import type { BuyerContext } from "@/features/business-units/types";
import { categoryPath } from "@/lib/urls";

const SPARE_PARTS_SLUG = "spare_parts";

// The same page for guests (list prices) and signed-in customers; recent orders are on the account page.
export async function HomeView({ context }: { context: BuyerContext }) {
  const tree = await getCategoryTree();
  const spareParts = tree.bySlug(SPARE_PARTS_SLUG);
  const machineRoots = tree.roots.filter((c) => c.id !== spareParts?.id);

  // Categories have no images: each tile uses the first product of its subtree (cached per store).
  const [banners, tiles, parts] = await Promise.all([
    // The main banner is the first thing on the page, so it isn't streamed in later like other CMS blocks.
    getBlocks({ placement: "home.hero", storeKey: context.storeKey }).catch((err) => {
      console.error("CMS hero failed", err?.body ?? err);
      return [];
    }),
    getCategoryTiles(context, machineRoots, tree),
    spareParts ? getProductsInCategories(context, tree.subtreeIds(spareParts.id), { limit: 12 }) : undefined,
  ]);
  const ship = context.defaultShippingAddress;
  const note = taxNote(context.country);

  return (
    <div className="flex flex-col gap-10">
      {validBanners(banners).length > 0 ? (
        <HeroBanners banners={banners} />
      ) : (
        // Default hero until a banner block is published in the Studio.
        <section className="flex flex-wrap items-end justify-between gap-6 rounded-md bg-gray-900 p-8 text-gray-50">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="m-0 text-sm uppercase tracking-widest text-orange-400">
              {context.guest || context.consumer ? "Industrial parts and machines" : context.businessUnitName}
            </p>
            <h1 className="m-0 text-3xl font-bold sm:text-4xl">Heavy equipment and the parts that keep it running</h1>
            <p className="m-0 text-gray-300">
              {context.consumer ? (
                <>Prices include VAT. Spare parts ship to Germany, France, Spain and the United Kingdom.</>
              ) : context.guest ? (
                <>
                  List prices.{" "}
                  <Link href="/login" className="text-gray-50">
                    Sign in
                  </Link>{" "}
                  to see your company&apos;s contract prices.
                </>
              ) : (
                <>
                  Contract prices for {context.storeName}
                  {ship && ` · delivering to ${[ship.city, ship.state, ship.country].filter(Boolean).join(", ")}`}.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {spareParts && (
              <Link
                href={categoryPath([SPARE_PARTS_SLUG])}
                className="rounded bg-orange-700 px-5 py-3 font-semibold text-white no-underline hover:bg-orange-800"
              >
                Shop spare parts
              </Link>
            )}
            <Link
              href="/quick-order"
              className="rounded border border-gray-500 px-5 py-3 font-semibold text-gray-50 no-underline hover:border-gray-300"
            >
              Order by SKU
            </Link>
          </div>
        </section>
      )}

      <CmsBlocks placement="home.top" context={context} />

      <CmsBlocks placement="home.featured" context={context} />

      <section aria-labelledby="machines">
        <h2 id="machines" className="mb-4 mt-0 text-xl font-semibold">
          Machines
        </h2>
        {/* Swipeable row: 2 tiles per view on phones, 3 on tablets, 5 on desktop. */}
        <Carousel label="Machines" itemClassName="w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(20%-0.8rem)]">
          {tiles.map(({ id, name, slug, total, image }) => (
            <Link
              key={id}
              href={categoryPath([slug])}
              className="flex h-full flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-gray-900 no-underline hover:border-orange-700"
            >
              {image ? (
                <Image
                  src={image}
                  alt=""
                  width={400}
                  height={300}
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                  className="aspect-[4/3] w-full object-contain"
                />
              ) : (
                <div aria-hidden="true" className="aspect-[4/3] w-full rounded bg-gray-100" />
              )}
              <span className="font-semibold">{name}</span>
              <span className="text-xs text-gray-600">{total} models · price on quote</span>
            </Link>
          ))}
        </Carousel>
      </section>

      {parts && parts.results.length > 0 && (
        <section aria-labelledby="parts">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="parts" className="m-0 text-xl font-semibold">
              Spare parts: order now
            </h2>
            <Link href={categoryPath([SPARE_PARTS_SLUG])} className="text-sm text-orange-800">
              All spare parts
            </Link>
          </div>
          <Carousel label="Spare parts: order now">
            {parts.results.map((p) => (
              <ProductCard key={p.id} product={p} canOrder={context.canOrder} canQuote={!context.consumer} note={note} />
            ))}
          </Carousel>
        </section>
      )}
    </div>
  );
}
