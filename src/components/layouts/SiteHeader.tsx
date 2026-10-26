import Link from "next/link";
import { SearchBox } from "@/components/layouts/SearchBox";
import { SiteLogo } from "@/components/layouts/SiteLogo";
import { CategoryMenu, type MenuItem } from "@/components/layouts/CategoryMenu";

// Magento-style header, domain-agnostic: the shop layout fills in the buying-context area and the sign-out action
// (src/components never imports features).
//   top bar:  who you're buying for · welcome, Quick order, My account, Sign out (guests: Sign in)
//   main row: logo · search · mini-cart
//   nav:      category menu
type Props = {
  // Undefined for guests.
  welcome?: string;
  // Who you're buying for (unit switcher, label or guest hint).
  context: React.ReactNode;
  signOutAction: () => Promise<void>;
  // The minicart (features/cart MiniCart): built from the server cart, or loaded in the browser on cached pages.
  cart: React.ReactNode;
  menu: MenuItem[];
};

const topLink = "flex min-h-11 items-center text-gray-200 no-underline hover:text-white hover:underline";

export function SiteHeader({ welcome, context, signOutAction, cart, menu }: Props) {
  return (
    <header className="bg-gray-900 text-gray-50">
      <div className="bg-gray-950 text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-4 sm:px-8">
          <div className="flex min-h-11 items-center">{context}</div>
          <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 p-0">
            {/* Guests see "Welcome to Ironline Supply" on the left (BuyingContextBadge). */}
            {welcome && <li className="hidden text-gray-300 md:block">Welcome, {welcome}!</li>}
            <li>
              <Link href="/quick-order" className={topLink}>
                Quick order
              </Link>
            </li>
            {welcome ? (
              <>
                <li>
                  <Link href="/account" className={topLink}>
                    My account
                  </Link>
                </li>
                <li>
                  <form action={signOutAction}>
                    <button className={`${topLink} bg-transparent p-0 text-xs`}>Sign out</button>
                  </form>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/login" className={`${topLink} font-semibold text-white`}>
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className={topLink}>
                    Create an account
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
        <SiteLogo />
        <SearchBox />
        {cart}
      </div>
      <CategoryMenu items={menu} />
    </header>
  );
}
