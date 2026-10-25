import Link from "next/link";
import { getImageProps } from "next/image";
import { isMediaUrl, safeHref, validBanners } from "@/features/cms/utils";
import type { CmsBlock } from "@/features/cms/types";
import { Carousel } from "@/components/ui/Carousel";

// Homepage main banner from CMS "banner" blocks (placement home.hero). One live banner is a full-width hero;
// several become a slider (no autoplay, like the product carousels). The first picture is the page's largest
// element, so it loads with priority; phones get the mobile picture when there is one.
export function HeroBanners({ banners }: { banners: CmsBlock[] }) {
  const valid = validBanners(banners);
  if (valid.length === 0) return null;
  if (valid.length === 1) return <HeroBanner banner={valid[0]} first />;
  return (
    <Carousel label="Promotions" itemClassName="w-full">
      {valid.map((b, i) => (
        <HeroBanner key={b.identifier} banner={b} first={i === 0} />
      ))}
    </Carousel>
  );
}

function HeroBanner({ banner, first }: { banner: CmsBlock; first: boolean }) {
  const dark = banner.theme !== "light";
  // getImageProps ignores `priority`: the first banner asks for high fetch priority itself, the rest load lazily.
  const common = { alt: banner.imageAlt ?? "", fill: true, sizes: "(min-width: 1280px) 1216px, 100vw" } as const;
  const { props: desktop } = getImageProps({ ...common, src: banner.image! });
  const mobile = isMediaUrl(banner.mobileImage) ? getImageProps({ ...common, src: banner.mobileImage, sizes: "100vw" }).props : undefined;
  const primary = banner.cta && safeHref(banner.cta.href);
  const secondary = banner.secondaryCta && safeHref(banner.secondaryCta.href);
  const Heading = first ? "h1" : "h2";

  return (
    <section
      data-cms-block={banner.identifier}
      className="relative isolate flex min-h-[340px] items-end overflow-hidden rounded-md bg-gray-900 sm:min-h-[420px] sm:items-center"
    >
      {/* Art direction needs <picture>; the <img> props (alt included) come from getImageProps. */}
      <picture>
        {mobile && <source media="(max-width: 640px)" srcSet={mobile.srcSet} sizes="100vw" />}
        <img {...desktop} alt={desktop.alt} fetchPriority={first ? "high" : undefined} loading={first ? "eager" : "lazy"} className="-z-20 object-cover" />
      </picture>
      {/* Keeps the text readable on any picture: dark or light wash from the text side. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 -z-10 ${
          dark
            ? "bg-gradient-to-t from-gray-950/90 via-gray-950/50 to-transparent sm:bg-gradient-to-r sm:from-gray-950/90 sm:via-gray-950/65"
            : "bg-gradient-to-t from-white/95 via-white/60 to-transparent sm:bg-gradient-to-r sm:from-white/90 sm:via-white/55"
        }`}
      />
      <div className={`flex max-w-xl flex-col gap-3 p-6 sm:p-10 ${dark ? "text-white" : "text-gray-900"}`}>
        <Heading className="m-0 text-3xl font-bold text-balance sm:text-4xl">{banner.headline}</Heading>
        {banner.content && <p className={`m-0 text-base sm:text-lg ${dark ? "text-gray-200" : "text-gray-700"}`}>{banner.content}</p>}
        {(primary || secondary) && (
          <div className="mt-2 flex flex-wrap gap-3">
            {primary && (
              <Link href={primary} className="rounded bg-orange-700 px-5 py-3 font-semibold text-white no-underline hover:bg-orange-800">
                {banner.cta!.label}
              </Link>
            )}
            {secondary && (
              <Link
                href={secondary}
                className={`rounded border px-5 py-3 font-semibold no-underline ${
                  dark ? "border-white/70 text-white hover:bg-white/10" : "border-gray-800 text-gray-900 hover:bg-gray-900/5"
                }`}
              >
                {banner.secondaryCta!.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
