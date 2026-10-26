import { getPages } from "@/features/cms/service";
import { categoryMenu, getCategoryTree } from "@/features/catalog/service";
import { getGuestContext } from "@/features/business-units/service";
import { SiteHeader } from "@/components/layouts/SiteHeader";
import { SiteFooter } from "@/components/layouts/SiteFooter";
import { BuyingContextBadge } from "@/features/business-units/components/BuyingContextBadge";
import { MiniCart } from "@/features/cart/components/MiniCart";
import { logout } from "@/features/auth/actions";

// Cached catalog for guests (home, categories, products, content pages without query parameters). src/middleware.ts
// rewrites guests here; signed-in customers and URLs with parameters use the per-visitor pages in (shop).
// Nothing here may read cookies or headers: the HTML is shared by every guest. The visitor's own cart is loaded in
// the browser (MiniCart live).
export const revalidate = 300;
// Fails the build if anything in the header or footer starts reading cookies or headers.
export const dynamic = "error";

export default async function CachedGuestLayout({ children }: { children: React.ReactNode }) {
  const [context, tree, pages] = await Promise.all([getGuestContext(), getCategoryTree(), getPages().catch(() => [])]);
  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-gray-800">
      <SiteHeader
        context={
          <BuyingContextBadge
            guest
            businessUnitName={context.businessUnitName}
            storeName={context.storeName}
            selectedKey={context.businessUnitKey}
            options={[]}
          />
        }
        signOutAction={logout}
        cart={<MiniCart live />}
        menu={categoryMenu(tree)}
      />
      {/* Grows to fill the window, so the footer stays at the bottom on short pages. */}
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8">
        {children}
      </main>
      <SiteFooter pages={pages} />
    </div>
  );
}
