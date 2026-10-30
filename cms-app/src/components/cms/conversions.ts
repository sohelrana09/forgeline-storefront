import {
  BLOCK_TYPES,
  CTA_HREF_PATTERN,
  KEY_PATTERN,
  PLACEMENTS,
  SKU_PATTERN,
  STYLES,
  THEMES,
  isMediaUrl,
} from '../../constants';

// Form values are flat strings/booleans; Custom Object values are the JSON the storefront reads.

export type TBlockForm = {
  key: string;
  title: string;
  active: boolean;
  placement: string;
  style: string;
  type: string;
  content: string;
  skus: string;
  stores: string;
  categories: string;
  sortOrder: string;
  ctaLabel: string;
  ctaHref: string;
  // Banner
  headline: string;
  image: string;
  mobileImage: string;
  imageAlt: string;
  theme: string;
  cta2Label: string;
  cta2Href: string;
  // Schedule (ISO date-times, '' = none)
  startsAt: string;
  endsAt: string;
};

const list = (value: unknown) => (Array.isArray(value) ? value.join(', ') : '');
const parseList = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
const str = (value: unknown) => (typeof value === 'string' ? value : '');

export const blockToForm = (
  key = '',
  v: Record<string, unknown> = {}
): TBlockForm => {
  const cta = (v.cta ?? {}) as Record<string, unknown>;
  const cta2 = (v.secondaryCta ?? {}) as Record<string, unknown>;
  return {
    key,
    title: str(v.title),
    active: v.active !== false,
    placement: str(v.placement) || PLACEMENTS[0],
    style: str(v.style) || 'plain',
    type: str(v.type) || 'markdown',
    content: str(v.content),
    skus: list(v.skus),
    stores: list(v.stores),
    categories: list(v.categories),
    sortOrder: typeof v.sortOrder === 'number' ? String(v.sortOrder) : '',
    ctaLabel: str(cta.label),
    ctaHref: str(cta.href),
    headline: str(v.headline),
    image: str(v.image),
    mobileImage: str(v.mobileImage),
    imageAlt: str(v.imageAlt),
    theme: str(v.theme) || 'dark',
    cta2Label: str(cta2.label),
    cta2Href: str(cta2.href),
    startsAt: str(v.startsAt),
    endsAt: str(v.endsAt),
  };
};

const link = (label: string, href: string) =>
  label.trim() && href.trim()
    ? { label: label.trim(), href: href.trim() }
    : undefined;

// Only writes the fields that apply, so the stored JSON matches what content/blocks/*.json would contain.
export const formToBlock = (f: TBlockForm): Record<string, unknown> => ({
  title: f.title.trim() || undefined,
  active: f.active,
  placement: f.placement,
  ...(f.type !== 'banner' && { style: f.style }),
  type: f.type,
  ...(f.type === 'markdown' && { content: f.content }),
  ...(f.type === 'products' && { skus: parseList(f.skus) }),
  ...(f.type === 'banner' && {
    headline: f.headline.trim(),
    ...(f.content.trim() && { content: f.content.trim() }),
    image: f.image,
    ...(f.mobileImage && { mobileImage: f.mobileImage }),
    ...(f.imageAlt.trim() && { imageAlt: f.imageAlt.trim() }),
    theme: f.theme,
    ...(link(f.cta2Label, f.cta2Href) && {
      secondaryCta: link(f.cta2Label, f.cta2Href),
    }),
  }),
  ...(f.startsAt && { startsAt: f.startsAt }),
  ...(f.endsAt && { endsAt: f.endsAt }),
  ...(parseList(f.stores).length > 0 && { stores: parseList(f.stores) }),
  ...(parseList(f.categories).length > 0 && {
    categories: parseList(f.categories),
  }),
  ...(f.sortOrder.trim() !== '' && { sortOrder: Number(f.sortOrder) }),
  ...(f.ctaLabel.trim() &&
    f.ctaHref.trim() && {
      cta: { label: f.ctaLabel.trim(), href: f.ctaHref.trim() },
    }),
});

// UI Kit field errors are { [errorKey]: true }; we use the message itself as the key and render it as is.
type TErrors<T> = Partial<Record<keyof T, Record<string, boolean>>>;

export const validateBlock = (f: TBlockForm): TErrors<TBlockForm> => {
  const e: TErrors<TBlockForm> = {};
  if (!KEY_PATTERN.test(f.key))
    e.key = { 'Lowercase letters, digits and dashes only': true };
  if (!(PLACEMENTS as readonly string[]).includes(f.placement))
    e.placement = { 'Choose a placement': true };
  if (f.type !== 'banner' && !(STYLES as readonly string[]).includes(f.style))
    e.style = { 'Choose a style': true };
  if (!(BLOCK_TYPES as readonly string[]).includes(f.type))
    e.type = { 'Choose a type': true };
  if (f.type === 'markdown' && !f.content.trim())
    e.content = { 'Content is required': true };
  if (f.type === 'products') {
    const skus = parseList(f.skus);
    if (skus.length === 0) e.skus = { 'Add at least one SKU': true };
    else if (!skus.every((s) => SKU_PATTERN.test(s)))
      e.skus = { 'SKUs may only contain letters, digits, . _ -': true };
  }
  if (f.type === 'banner') {
    if (!f.headline.trim()) e.headline = { 'Headline is required': true };
    if (!isMediaUrl(f.image))
      e.image = {
        'Choose or upload an image from the media library': true,
      };
    if (f.mobileImage && !isMediaUrl(f.mobileImage))
      e.mobileImage = { 'Use an image from the media library': true };
    if (!(THEMES as readonly string[]).includes(f.theme))
      e.theme = { 'Choose a text colour': true };
    if (
      (f.cta2Label.trim() || f.cta2Href.trim()) &&
      !(f.cta2Label.trim() && CTA_HREF_PATTERN.test(f.cta2Href.trim()))
    )
      e.cta2Href = {
        'Give a label and a link starting with "/" or "https:"': true,
      };
  }
  if (f.startsAt && f.endsAt && Date.parse(f.endsAt) <= Date.parse(f.startsAt))
    e.endsAt = { 'Must be after the start': true };
  if (f.sortOrder.trim() !== '' && !Number.isFinite(Number(f.sortOrder)))
    e.sortOrder = { 'Must be a number': true };
  if (
    (f.ctaLabel.trim() || f.ctaHref.trim()) &&
    !(f.ctaLabel.trim() && CTA_HREF_PATTERN.test(f.ctaHref.trim()))
  ) {
    e.ctaHref = {
      'Give a label and a link starting with "/" or "https:"': true,
    };
  }
  return e;
};
