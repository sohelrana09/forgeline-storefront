import { SearchBox } from "@/components/layouts/SearchBox";
import { SiteLogo } from "@/components/layouts/SiteLogo";
import { CategoryMenu, type MenuItem } from "@/components/layouts/CategoryMenu";

// Store header, domain-agnostic: the layout fills in the buying-context area, the account links and the minicart
// (src/components never imports features). Everything else is the same for every visitor, so it is part of the
// prerendered shell.
//   top bar:  who you're buying for · welcome, Quick order, My account, Sign out (guests: Sign in)
//   main row: logo · search · mini-cart
//   nav:      category menu
type Props = {
  // Who you're buying for (unit switcher, label or guest hint).
  context: React.ReactNode;
  // The top-right links (AccountLinks): differ for guests and signed-in visitors, so the layout streams them in.
  account: React.ReactNode;
  // The minicart (features/cart MiniCart), built from the visitor's cart on the server.
  cart: React.ReactNode;
  menu: MenuItem[];
};

export function SiteHeader({ context, account, cart, menu }: Props) {
  return (
    <header className="bg-gray-900 text-gray-50">
      <div className="bg-gray-950 text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-4 sm:px-8">
          <div className="flex min-h-11 items-center">{context}</div>
          {account}
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
