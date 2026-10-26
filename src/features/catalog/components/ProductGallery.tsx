"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { GalleryImage } from "@/features/catalog/utils";

// Magento-style product gallery: main image with previous/next (buttons, arrow keys, swipe), thumbnails below and
// a full-screen view. Each picture says which variant it shows; one of another variant links to that variant.
// The parent keys it by the selected SKU, so choosing a variant starts on that variant's picture.
export function ProductGallery({
  images,
  name,
  slug,
  selectedSku,
}: {
  images: GalleryImage[];
  name: string;
  slug: string;
  selectedSku?: string;
}) {
  const start = Math.max(
    0,
    images.findIndex((img) => selectedSku !== undefined && img.skus.includes(selectedSku)),
  );
  const [index, setIndex] = useState(start);
  const dialog = useRef<HTMLDialogElement>(null);
  const swipeStart = useRef<number | undefined>(undefined);
  // A swipe ends with a click on the image button: that click must not open the full-screen view.
  const swiped = useRef(false);
  const count = images.length;
  const current = images[index];
  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  if (!current) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded bg-gray-100 text-sm text-gray-500">
        No image for this product
      </div>
    );
  }

  const label = (img: GalleryImage) => (img.value ? `${img.kind === "model" ? "Model year" : "Color"} ${img.value}` : undefined);
  const alt = (img: GalleryImage) => [name, label(img)].filter(Boolean).join(", ");
  const otherVariant = selectedSku !== undefined && !current.skus.includes(selectedSku) ? current.skus[0] : undefined;
  // The page behind stays put while it's open: see the :modal rule in globals.css.
  const open = () => {
    if (swiped.current) swiped.current = false;
    else dialog.current?.showModal();
  };
  const onKey = (e: KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  };
  const onPointerDown = (e: PointerEvent) => {
    swipeStart.current = e.pointerType === "mouse" ? undefined : e.clientX;
    swiped.current = false;
  };
  const onPointerUp = (e: PointerEvent) => {
    const from = swipeStart.current;
    swipeStart.current = undefined;
    if (from === undefined || count < 2) return;
    const dx = e.clientX - from;
    if (Math.abs(dx) > 40) {
      swiped.current = true;
      go(dx < 0 ? 1 : -1);
    }
  };
  const onPointerCancel = () => {
    swipeStart.current = undefined;
  };
  const arrow =
    "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white/90 text-xl text-gray-800 shadow-sm hover:bg-white";
  const position = `Image ${index + 1} of ${count}${label(current) ? `: ${label(current)}` : ""}`;

  // Arrow keys work in the gallery and in the full-screen view (its key events bubble up to this element).
  return (
    <div className="flex flex-col gap-3" role="region" aria-roledescription="gallery" aria-label={`${name} images`} onKeyDown={onKey}>
      <p className="sr-only" aria-live="polite">
        {count > 1 ? position : ""}
      </p>
      <div className="relative touch-pan-y" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
        <button
          type="button"
          onClick={open}
          className="block w-full cursor-zoom-in border-0 bg-gray-50 p-0"
          aria-label={`View ${alt(current)} full screen`}
          aria-haspopup="dialog"
        >
          <Image
            // A new element per picture: the previous one disappears at once instead of lingering under the new caption.
            key={current.url}
            src={current.url}
            alt={alt(current)}
            width={800}
            height={600}
            // The first picture is the page's largest element: load it first.
            priority={index === start}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="aspect-[4/3] w-full object-contain"
            draggable={false}
          />
        </button>
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className={`${arrow} left-1`} aria-label="Previous image">
              ‹
            </button>
            <button type="button" onClick={() => go(1)} className={`${arrow} right-1`} aria-label="Next image">
              ›
            </button>
            <p className="absolute right-2 bottom-2 m-0 rounded bg-gray-900/70 px-2 py-0.5 text-xs text-white" aria-hidden="true">
              {index + 1} / {count}
            </p>
          </>
        )}
      </div>

      {(label(current) || otherVariant) && (
        <p className="m-0 flex flex-wrap items-center gap-x-3 text-sm text-gray-700">
          {label(current) && <span>{label(current)}</span>}
          {otherVariant && (
            <Link href={`/p/${slug}?sku=${otherVariant}`} className="font-semibold text-orange-800">
              Choose this {current.kind === "color" ? "color" : "model"}
            </Link>
          )}
        </p>
      )}

      {count > 1 && (
        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0">
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}${label(img) ? `: ${label(img)}` : ""}`}
                aria-current={i === index ? "true" : undefined}
                className={`block size-20 rounded border-2 bg-white p-1 ${i === index ? "border-orange-700" : "border-gray-200 hover:border-gray-400"}`}
              >
                <Image src={img.url} alt="" width={80} height={80} sizes="80px" className="size-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        aria-label={`${name}, full-screen view`}
        className="m-0 h-dvh max-h-none w-dvw max-w-none bg-white p-0 backdrop:bg-gray-900/80"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-2">
            <p className="m-0 text-sm text-gray-700">
              {[name, label(current), count > 1 ? `${index + 1} / ${count}` : undefined].filter(Boolean).join(" · ")}
            </p>
            <form method="dialog">
              <button className="min-h-11 rounded border border-gray-300 px-4 text-sm font-semibold" aria-label="Close full-screen view">
                Close
              </button>
            </form>
          </div>
          <div className="relative min-h-0 flex-1 touch-pan-y">
            <Image
              key={current.url}
              src={current.url}
              alt={alt(current)}
              fill
              sizes="100vw"
              className="object-contain p-4"
              draggable={false}
            />
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} className={`${arrow} left-3`} aria-label="Previous image">
                  ‹
                </button>
                <button type="button" onClick={() => go(1)} className={`${arrow} right-3`} aria-label="Next image">
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
