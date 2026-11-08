// Languages (docs/features/i18n.md), pure and unit-tested. One language per deployment: NEXT_PUBLIC_SITE_LOCALE picks
// the commercetools locale for product and category data, the <html lang>, number and date formats, and the UI
// dictionary. It is read at build time (inlined into client code), so prerendered shells stay the same for every
// visitor; a second language is a second deployment (for example de.example.com), which keeps every page cacheable.

export const SITE_LOCALES = ["en-US", "en-GB", "de-DE", "es-ES", "fr-FR", "it-IT", "nl-NL", "pt-PT"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

export function siteLocale(value: string | undefined = process.env.NEXT_PUBLIC_SITE_LOCALE): SiteLocale {
  return (SITE_LOCALES as readonly string[]).includes(value ?? "") ? (value as SiteLocale) : "en-US";
}

export const language = (locale: SiteLocale = siteLocale()) => locale.slice(0, 2);

// English deployments keep day-month-year dates (as the storefront always showed them); others use their own.
export const dateLocale = (locale: SiteLocale = siteLocale()) => (language(locale) === "en" ? "en-GB" : locale);

// A localized value in the site's locale, else another variant of the same language, else US English, else any.
export function localizeIn(value: Record<string, string> | undefined, locale: SiteLocale = siteLocale()): string {
  if (!value) return "";
  if (value[locale]) return value[locale];
  const lang = language(locale);
  const sameLanguage = Object.keys(value).find((k) => k.slice(0, 2) === lang && value[k]);
  return (sameLanguage && value[sameLanguage]) ?? value["en-US"] ?? Object.values(value)[0] ?? "";
}

// ---------- UI dictionary ----------

const en = {
  "search.placeholder": "Search by product name, model or SKU",
  "search.button": "Search",
  "search.none": "No matching products",
  "search.suggestions": "Search suggestions",
  "header.quickOrder": "Quick order",
  "header.myAccount": "My account",
  "header.signIn": "Sign in",
  "header.signOut": "Sign out",
  "header.register": "Create an account",
  "header.welcome": "Welcome, {name}!",
  "header.myCart": "My cart",
  "header.cart": "Cart",
  "header.empty": "Empty",
  "cart.add": "Add to cart",
  "cart.addForQuote": "Add for quote",
  "cart.onlyBuyers": "Only buyers can order.",
  "cart.quoteOnly": "Sold to business customers on quote.",
  "pdp.inStock": "In stock · {count} available",
  "pdp.outOfStock": "Out of stock",
  "pdp.onRequest": "Availability on request",
  "pdp.specifications": "Specifications",
  "pdp.downloads": "Downloads",
  "pdp.specSheet": "Spec sheet (PDF)",
  "pdp.compatible": "Compatible spare parts",
  "pdp.moreIn": "More in {category}",
  "pdp.fits": "Fits",
  "pdp.recentlyViewed": "Recently viewed",
  "pdp.compare": "Compare",
  "plp.shopBy": "Shop By",
  "plp.nowShopping": "Now Shopping by",
  "plp.clearAll": "Clear All",
  "plp.noProducts": "No products",
  "plp.items": "{count} items",
  "plp.item": "1 item",
  "plp.range": "Items {from}–{to} of {total}",
  "plp.grid": "Grid",
  "plp.table": "Table",
  "plp.viewAs": "View as",
  "plp.apply": "Apply",
  "plp.sortBy": "Sort By",
  "plp.show": "Show",
  "plp.perPage": "per page",
  "plp.price": "Price",
};

export type MessageKey = keyof typeof en;
type Dictionary = Record<MessageKey, string>;

const de: Dictionary = {
  "search.placeholder": "Suche nach Produktname, Modell oder Artikelnummer",
  "search.button": "Suchen",
  "search.none": "Keine passenden Produkte",
  "search.suggestions": "Suchvorschläge",
  "header.quickOrder": "Schnellbestellung",
  "header.myAccount": "Mein Konto",
  "header.signIn": "Anmelden",
  "header.signOut": "Abmelden",
  "header.register": "Konto erstellen",
  "header.welcome": "Willkommen, {name}!",
  "header.myCart": "Warenkorb",
  "header.cart": "Warenkorb",
  "header.empty": "Leer",
  "cart.add": "In den Warenkorb",
  "cart.addForQuote": "Für Angebot vormerken",
  "cart.onlyBuyers": "Nur Einkäufer können bestellen.",
  "cart.quoteOnly": "Für Geschäftskunden auf Angebot.",
  "pdp.inStock": "Auf Lager · {count} verfügbar",
  "pdp.outOfStock": "Nicht auf Lager",
  "pdp.onRequest": "Verfügbarkeit auf Anfrage",
  "pdp.specifications": "Technische Daten",
  "pdp.downloads": "Downloads",
  "pdp.specSheet": "Datenblatt (PDF)",
  "pdp.compatible": "Passende Ersatzteile",
  "pdp.moreIn": "Mehr in {category}",
  "pdp.fits": "Passt zu",
  "pdp.recentlyViewed": "Zuletzt angesehen",
  "pdp.compare": "Vergleichen",
  "plp.shopBy": "Filtern nach",
  "plp.nowShopping": "Aktive Filter",
  "plp.clearAll": "Alle entfernen",
  "plp.noProducts": "Keine Produkte",
  "plp.items": "{count} Artikel",
  "plp.item": "1 Artikel",
  "plp.range": "Artikel {from}–{to} von {total}",
  "plp.grid": "Raster",
  "plp.table": "Tabelle",
  "plp.viewAs": "Ansicht",
  "plp.apply": "Anwenden",
  "plp.sortBy": "Sortieren nach",
  "plp.show": "Zeige",
  "plp.perPage": "pro Seite",
  "plp.price": "Preis",
};

const es: Dictionary = {
  "search.placeholder": "Buscar por nombre, modelo o referencia",
  "search.button": "Buscar",
  "search.none": "No hay productos que coincidan",
  "search.suggestions": "Sugerencias de búsqueda",
  "header.quickOrder": "Pedido rápido",
  "header.myAccount": "Mi cuenta",
  "header.signIn": "Iniciar sesión",
  "header.signOut": "Cerrar sesión",
  "header.register": "Crear una cuenta",
  "header.welcome": "¡Hola, {name}!",
  "header.myCart": "Mi carrito",
  "header.cart": "Carrito",
  "header.empty": "Vacío",
  "cart.add": "Añadir al carrito",
  "cart.addForQuote": "Añadir para presupuesto",
  "cart.onlyBuyers": "Solo los compradores pueden pedir.",
  "cart.quoteOnly": "Para empresas, bajo presupuesto.",
  "pdp.inStock": "En stock · {count} disponibles",
  "pdp.outOfStock": "Agotado",
  "pdp.onRequest": "Disponibilidad bajo consulta",
  "pdp.specifications": "Especificaciones",
  "pdp.downloads": "Descargas",
  "pdp.specSheet": "Ficha técnica (PDF)",
  "pdp.compatible": "Repuestos compatibles",
  "pdp.moreIn": "Más en {category}",
  "pdp.fits": "Compatible con",
  "pdp.recentlyViewed": "Vistos recientemente",
  "pdp.compare": "Comparar",
  "plp.shopBy": "Filtrar por",
  "plp.nowShopping": "Filtros activos",
  "plp.clearAll": "Quitar todo",
  "plp.noProducts": "Ningún producto",
  "plp.items": "{count} artículos",
  "plp.item": "1 artículo",
  "plp.range": "Artículos {from}–{to} de {total}",
  "plp.grid": "Cuadrícula",
  "plp.table": "Tabla",
  "plp.viewAs": "Ver como",
  "plp.apply": "Aplicar",
  "plp.sortBy": "Ordenar por",
  "plp.show": "Mostrar",
  "plp.perPage": "por página",
  "plp.price": "Precio",
};

const fr: Dictionary = {
  "search.placeholder": "Rechercher par nom, modèle ou référence",
  "search.button": "Rechercher",
  "search.none": "Aucun produit correspondant",
  "search.suggestions": "Suggestions de recherche",
  "header.quickOrder": "Commande rapide",
  "header.myAccount": "Mon compte",
  "header.signIn": "Se connecter",
  "header.signOut": "Se déconnecter",
  "header.register": "Créer un compte",
  "header.welcome": "Bienvenue, {name} !",
  "header.myCart": "Mon panier",
  "header.cart": "Panier",
  "header.empty": "Vide",
  "cart.add": "Ajouter au panier",
  "cart.addForQuote": "Ajouter pour devis",
  "cart.onlyBuyers": "Seuls les acheteurs peuvent commander.",
  "cart.quoteOnly": "Vendu aux professionnels sur devis.",
  "pdp.inStock": "En stock · {count} disponibles",
  "pdp.outOfStock": "En rupture de stock",
  "pdp.onRequest": "Disponibilité sur demande",
  "pdp.specifications": "Caractéristiques",
  "pdp.downloads": "Téléchargements",
  "pdp.specSheet": "Fiche technique (PDF)",
  "pdp.compatible": "Pièces compatibles",
  "pdp.moreIn": "Plus dans {category}",
  "pdp.fits": "Compatible avec",
  "pdp.recentlyViewed": "Vus récemment",
  "pdp.compare": "Comparer",
  "plp.shopBy": "Filtrer par",
  "plp.nowShopping": "Filtres actifs",
  "plp.clearAll": "Tout effacer",
  "plp.noProducts": "Aucun produit",
  "plp.items": "{count} articles",
  "plp.item": "1 article",
  "plp.range": "Articles {from}–{to} sur {total}",
  "plp.grid": "Grille",
  "plp.table": "Tableau",
  "plp.viewAs": "Afficher en",
  "plp.apply": "Appliquer",
  "plp.sortBy": "Trier par",
  "plp.show": "Afficher",
  "plp.perPage": "par page",
  "plp.price": "Prix",
};

export const DICTIONARIES: Record<string, Dictionary> = { en, de, es, fr };

// The UI text in the site's language (English where no dictionary exists yet), with {placeholders} filled in.
export function t(key: MessageKey, vars: Record<string, string | number> = {}, locale: SiteLocale = siteLocale()): string {
  const text = (DICTIONARIES[language(locale)] ?? en)[key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
