import { Suspense } from "react";
import { cache } from "react";
import { cookies } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getActiveCart } from "@/features/cart/service";
import { getPages } from "@/features/cms/service";
import { categoryMenu, getCategoryTree } from "@/features/catalog/service";
import { currentBrowseContext, type BrowseContext } from "@/features/business-units/context";
import { getGuestContext } from "@/features/business-units/service";
import { SiteHeader } from "@/components/layouts/SiteHeader";
import { SiteFooter } from "@/components/layouts/SiteFooter";
import { AccountLinks } from "@/components/layouts/AccountLinks";
import { MiniCartPlaceholder } from "@/components/layouts/MiniCartBadge";
import { footerLinks } from "@/app/_components/footer-links";
import { MiniCart } from "@/features/cart/components/MiniCart";
import { toMiniCart } from "@/features/cart/minicart";
import { BuyingContextBadge } from "@/features/business-units/components/BuyingContextBadge";
import { logout } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { PageMessages } from "@/components/ui/PageMessages";
import { MESSAGES_COOKIE } from "@/lib/messages";

// Route-only glue: the header, page column and footer that the shop, store and sign-in layouts share. The menu and
// footer come from cached reads, so on (shop) pages they are part of the prerendered shell; who is visiting (buying
// context, account links, minicart, page messages) reads cookies and streams in behind <Suspense>.
// `lenient` (sign-in pages): a visitor whose session can't be read, or whose company account isn't ready
// (/no-access), gets guest prices instead of a redirect, so these pages never loop back to themselves; a readable
// session still shows as signed in.
export async function SiteChrome({ children, lenient = false }: { children: React.ReactNode; lenient?: boolean }) {
  const [tree, pages] = await Promise.all([getCategoryTree(), getPages().catch(() => [])]);
  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-gray-800">
      <SiteHeader
        context={
          <Suspense>
            <VisitorContext lenient={lenient} />
          </Suspense>
        }
        account={
          <Suspense fallback={<AccountLinks pending />}>
            <VisitorAccount lenient={lenient} />
          </Suspense>
        }
        cart={
          <Suspense fallback={<MiniCartPlaceholder />}>
            <VisitorCart lenient={lenient} />
          </Suspense>
        }
        menu={categoryMenu(tree)}
      />
      {/* Grows to fill the window, so the footer stays at the bottom on short pages. */}
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8">
        {/* No fallback: the bar mounts once, with the cookie's hint, so it never takes a message and loses it. */}
        <Suspense>
          <Messages />
        </Suspense>
        {children}
      </main>
      <SiteFooter links={footerLinks(pages)} />
    </div>
  );
}

// One lookup per request, shared by the streamed parts.
const visitor = cache(async (lenient: boolean): Promise<BrowseContext> => {
  try {
    return await currentBrowseContext();
  } catch (err) {
    if (!lenient || !isRedirectError(err)) throw err;
    return { session: await getSession(), contexts: [], context: await getGuestContext() };
  }
});

async function VisitorContext({ lenient }: { lenient: boolean }) {
  const { contexts, context } = await visitor(lenient);
  return (
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
  );
}

async function VisitorAccount({ lenient }: { lenient: boolean }) {
  const { session } = await visitor(lenient);
  return <AccountLinks welcome={session && (session.name || session.email)} signOutAction={logout} />;
}

async function VisitorCart({ lenient }: { lenient: boolean }) {
  const { session, auth, cartId, context } = await visitor(lenient);
  const cart = auth ? await getActiveCart(auth, cartId, context) : undefined;
  // A signed-in buyer's cart found without its cookie (or with a stale one): the minicart saves the cookie once.
  return <MiniCart initial={toMiniCart(cart, context.canOrder)} remember={Boolean(session && cart && cart.id !== cartId)} />;
}

// Page messages; the cookie value tells the bar when a form action left a new one.
async function Messages() {
  return <PageMessages hint={(await cookies()).get(MESSAGES_COOKIE)?.value} />;
}
