// The store logo. A plain link (not next/link) on purpose: like Magento, clicking it always loads the homepage
// fresh, also when you are already on it.
export function SiteLogo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load is the point
    <a href="/" className={`text-2xl font-bold tracking-wide text-gray-50 no-underline ${className}`}>
      IRONLINE<span className="text-orange-500"> SUPPLY</span>
    </a>
  );
}
