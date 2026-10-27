import { cookies } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getActiveCart } from "@/features/cart/service";
import { getPages } from "@/features/cms/service";
import { categoryMenu, getCategoryTree } from "@/features/catalog/service";
import { currentBrowseContext, type BrowseContext } from "@/features/business-units/context";
import { getGuestContext } from "@/features/business-units/service";
import { SiteHeader } from "@/components/layouts/SiteHeader";
import { SiteFooter } from "@/components/layouts/SiteFooter";
import { MiniCart } from "@/features/cart/components/MiniCart";
import { toMiniCart } from "@/features/cart/minicart";
import { BuyingContextBadge } from "@/features/business-units/components/BuyingContextBadge";
import { logout } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { PageMessages } from "@/components/ui/PageMessages";
import { MESSAGES_COOKIE } from "@/lib/messages";

// Route-only glue: the header, page column and footer that the (shop) and (auth) layouts share (the cached guest
// layout builds its own, without cookies). `lenient` (sign-in pages): a visitor whose session can't be read, or
// whose company account isn't ready (/no-access), gets guest prices instead of a redirect, so these pages never
// loop back to themselves; a readable session still shows as signed in.
export async function SiteChrome({ children, lenient = false }: { children: React.ReactNode; lenient?: boolean }) {
  let browse: BrowseContext;
  try {
    browse = await currentBrowseContext();
  } catch (err) {
    if (!lenient || !isRedirectError(err)) throw err;
    browse = { session: await getSession(), contexts: [], context: await getGuestContext() };
  }
  const { session, auth, contexts, context, cartId } = browse;
  const [cart, tree, pages] = await Promise.all([
    auth ? getActiveCart(auth, cartId, context) : undefined,
    getCategoryTree(),
    getPages().catch(() => []),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-gray-800">
      <SiteHeader
        welcome={session && (session.name || session.email)}
        context={
          <BuyingContextBadge
            guest={Boolean(context.guest)}
            consumer={Boolean(context.consumer)}
            businessUnitName={context.businessUnitName}
            storeName={context.storeName}
            selectedKey={context.businessUnitKey}
            options={contexts.map((c) => ({
              key: c.businessUnitKey,
              label: `${c.unitType === "Division" ? "↳ " : ""}${c.businessUnitName} · ${c.storeName} · ${c.currency}`,
            }))}
          />
        }
        signOutAction={logout}
        cart={<MiniCart initial={toMiniCart(cart, context.canOrder)} />}
        menu={categoryMenu(tree)}
      />
      {/* Grows to fill the window, so the footer stays at the bottom on short pages. */}
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8">
        {/* Page messages; the cookie value tells the bar when a form action left a new one. */}
        <PageMessages hint={(await cookies()).get(MESSAGES_COOKIE)?.value} />
        {children}
      </main>
      <SiteFooter pages={pages} />
    </div>
  );
}
