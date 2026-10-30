import Link from "next/link";

// The header's top-right links: Quick order, then My account and Sign out for a signed-in visitor, or Sign in and
// Create an account for a guest. `pending` (while the visitor streams in on a prerendered page) shows Quick order only,
// so a signed-in visitor never sees "Sign in" flash.
const topLink = "flex min-h-11 items-center text-gray-200 no-underline hover:text-white hover:underline";

export function AccountLinks({
  welcome,
  signOutAction,
  pending = false,
}: {
  // Undefined for guests.
  welcome?: string;
  signOutAction?: () => Promise<void>;
  pending?: boolean;
}) {
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 p-0">
      {/* Guests see "Welcome to Ironline Supply" on the left (BuyingContextBadge). */}
      {welcome && <li className="hidden text-gray-300 md:block">Welcome, {welcome}!</li>}
      <li>
        <Link href="/quick-order" className={topLink}>
          Quick order
        </Link>
      </li>
      {pending ? null : welcome ? (
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
  );
}
