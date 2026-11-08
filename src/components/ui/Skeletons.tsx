// Placeholders shown while a page's content streams in (the header and footer are already there). Each one has the
// layout of the page it stands in for (the same columns, boxes and widths), so the content fills in without the page
// changing shape. Static on purpose: nothing pulses or fades.
import type { ReactNode } from "react";

const bar = "rounded bg-gray-200";
const soft = "rounded bg-gray-100";

function Loading({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-label={label} className={className ?? "flex flex-col gap-6"}>
      {children}
    </div>
  );
}

const Heading = ({ width = "w-64" }: { width?: string }) => <div className={`h-8 ${width} ${bar}`} />;
const Crumbs = () => <div className={`h-4 w-48 ${soft}`} />;
const Panel = ({ className = "", children }: { className?: string; children?: ReactNode }) => (
  <div className={`rounded-md border border-gray-200 bg-white ${className}`}>{children}</div>
);
const Lines = ({ count, last = "w-2/3" }: { count: number; last?: string }) => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className={`h-4 ${i === count - 1 ? last : "w-full"} ${soft}`} />
    ))}
  </div>
);

function ProductTile() {
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className={`aspect-square w-full ${soft}`} />
      <div className={`h-4 w-3/4 ${bar}`} />
      <div className={`h-4 w-1/3 ${bar}`} />
      <div className={`h-10 w-full ${soft}`} />
    </Panel>
  );
}

// Order summary box (cart, checkout, order confirmation).
function SummaryPanel() {
  return (
    <Panel className="flex w-full flex-col gap-3 p-5 md:max-w-sm md:flex-[1_1_320px]">
      <div className={`h-5 w-32 ${bar}`} />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <div className={`h-4 w-24 ${soft}`} />
          <div className={`h-4 w-14 ${soft}`} />
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-gray-200 pt-4">
        <div className={`h-5 w-16 ${bar}`} />
        <div className={`h-5 w-20 ${bar}`} />
      </div>
      <div className={`mt-2 h-12 w-full ${bar}`} />
    </Panel>
  );
}

// Lines of a cart or order: picture, name and SKU, amount.
function LinesPanel({ rows }: { rows: number }) {
  return (
    <Panel className="min-w-0 flex-[999_1_560px]">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-gray-100 p-4 last:border-b-0">
          <div className={`size-16 flex-none ${soft}`} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className={`h-4 w-1/2 ${bar}`} />
            <div className={`h-3 w-24 ${soft}`} />
          </div>
          <div className={`h-5 w-16 ${bar}`} />
        </div>
      ))}
    </Panel>
  );
}

// Search results: breadcrumbs, heading, toolbar, product grid.
export function ProductGridSkeleton() {
  return (
    <Loading label="Loading products">
      <Crumbs />
      <Heading />
      <ProductResults />
    </Loading>
  );
}

function ProductResults({ tiles = 8 }: { tiles?: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className={`h-4 w-28 ${soft}`} />
        <div className={`h-10 w-56 ${soft}`} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: tiles }, (_, i) => (
          <ProductTile key={i} />
        ))}
      </div>
    </div>
  );
}

// A category's listing under its heading: "Shop By" filters on the left, toolbar and products on the right.
export function CategoryListingSkeleton() {
  return (
    <Loading label="Loading products" className="flex flex-col gap-6 lg:flex-row">
      <Panel className="hidden flex-col gap-4 p-4 lg:flex lg:w-64 lg:flex-none">
        <div className={`h-5 w-24 ${bar}`} />
        <Lines count={3} />
        <div className={`h-5 w-20 ${bar}`} />
        <Lines count={4} last="w-1/2" />
      </Panel>
      <div className={`h-11 w-full lg:hidden ${soft}`} />
      <ProductResults tiles={6} />
    </Loading>
  );
}

// Home: the hero banner, then rows of tiles.
export function HomeSkeleton() {
  return (
    <Loading label="Loading" className="flex flex-col gap-10">
      <div className="min-h-[340px] rounded-md bg-gray-900 sm:min-h-[420px]" />
      {Array.from({ length: 2 }, (_, row) => (
        <div key={row} className="flex flex-col gap-4">
          <div className={`h-6 w-40 ${bar}`} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={i >= 3 ? "hidden lg:block" : i === 2 ? "hidden sm:block" : ""}>
                <ProductTile />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Loading>
  );
}

// A content page: one white article box.
export function ArticleSkeleton() {
  return (
    <Loading label="Loading page">
      <Crumbs />
      <Panel className="flex max-w-3xl flex-col gap-5 p-6">
        <Heading />
        <Lines count={4} />
        <div className={`h-6 w-48 ${bar}`} />
        <Lines count={3} last="w-1/2" />
      </Panel>
    </Loading>
  );
}

// Blog pages: posts (or one post) on the left, the sidebar (categories, recent posts, tags) on the right.
export function BlogSkeleton({ post = false }: { post?: boolean }) {
  return (
    <Loading label="Loading blog">
      <Crumbs />
      <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Heading width={post ? "w-3/4" : "w-32"} />
          {post ? (
            <Panel className="flex flex-col gap-5 p-6">
              <div className={`aspect-[2/1] w-full ${soft}`} />
              <Lines count={5} />
              <Lines count={4} last="w-1/2" />
            </Panel>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Panel key={i} className="flex flex-col gap-3 p-5">
                  <div className={`h-3 w-32 ${soft}`} />
                  <div className={`h-5 w-full ${bar}`} />
                  <Lines count={3} />
                </Panel>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className={`h-4 w-24 ${bar}`} />
              <Lines count={2} />
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}

// Cart: heading, lines on the left, summary on the right.
export function CartSkeleton() {
  return (
    <Loading label="Loading cart">
      <Heading width="w-24" />
      <div className="flex flex-wrap items-start gap-6">
        <LinesPanel rows={2} />
        <SummaryPanel />
      </div>
    </Loading>
  );
}

// Order confirmation: the thank-you banner, then the order's lines and its summary.
export function OrderConfirmationSkeleton() {
  return (
    <Loading label="Loading your order">
      <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 p-5">
        <div className="h-7 w-72 rounded bg-green-100" />
        <div className="h-4 w-96 max-w-full rounded bg-green-100" />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <LinesPanel rows={2} />
        <SummaryPanel />
      </div>
    </Loading>
  );
}

// Checkout: steps 1 to 3 on the left, the order summary beside them.
export function CheckoutSkeleton() {
  const step = (n: number, fields: number) => (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-500">{n}</span>
        <div className={`h-5 w-40 ${bar}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="h-11 rounded border border-gray-200 bg-gray-50" />
        ))}
      </div>
    </Panel>
  );
  return (
    <Loading label="Loading checkout">
      <Heading width="w-40" />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
          {step(1, 6)}
          {step(2, 2)}
          {step(3, 2)}
        </div>
        <SummaryPanel />
      </div>
    </Loading>
  );
}

// Quick order: the SKU form on the left, the catalog table on the right.
export function QuickOrderSkeleton() {
  return (
    <Loading label="Loading quick order" className="flex flex-wrap items-start gap-6">
      <Panel className="flex w-full flex-col gap-3 p-5 md:max-w-sm md:flex-[1_1_300px]">
        <div className={`h-6 w-32 ${bar}`} />
        <Lines count={2} />
        <div className={`h-10 w-full ${soft}`} />
        <div className={`h-40 w-full ${soft}`} />
        <div className={`h-12 w-full ${bar}`} />
      </Panel>
      <Panel className="min-w-0 flex-[999_1_560px]">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className={`h-6 w-40 ${bar}`} />
          <div className={`h-4 w-32 ${soft}`} />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 p-4 last:border-b-0">
            <div className={`size-10 flex-none ${soft}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className={`h-4 w-3/4 ${bar}`} />
              <div className={`h-3 w-24 ${soft}`} />
            </div>
            <div className={`h-10 w-24 ${soft}`} />
          </div>
        ))}
      </Panel>
    </Loading>
  );
}

// An account section (the sidebar stays): heading and two boxes.
export function AccountSkeleton() {
  return (
    <Loading label="Loading">
      <Heading width="w-48" />
      {Array.from({ length: 2 }, (_, i) => (
        <Panel key={i} className="flex flex-col gap-4 p-5">
          <div className={`h-5 w-40 ${bar}`} />
          <Lines count={4} />
        </Panel>
      ))}
    </Loading>
  );
}
