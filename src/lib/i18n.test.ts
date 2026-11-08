import { describe, expect, it } from "vitest";
import { DICTIONARIES, dateLocale, localizeIn, siteLocale, t } from "@/lib/i18n";

describe("siteLocale", () => {
  it("accepts supported locales only, US English by default", () => {
    expect(siteLocale("de-DE")).toBe("de-DE");
    expect(siteLocale("xx-YY")).toBe("en-US");
    expect(siteLocale(undefined)).toBe("en-US");
  });
  it("keeps day-month-year dates for English", () => {
    expect(dateLocale("en-US")).toBe("en-GB");
    expect(dateLocale("fr-FR")).toBe("fr-FR");
  });
});

describe("localizeIn", () => {
  const name = { "en-US": "Spare Parts", "en-GB": "Spare Parts (GB)", "de-DE": "Ersatzteile", "pt-PT": "Peças" };
  it("prefers the locale, then the same language, then US English, then anything", () => {
    expect(localizeIn(name, "de-DE")).toBe("Ersatzteile");
    expect(localizeIn({ "de-AT": "Ersatzteile (AT)", "en-US": "x" }, "de-DE")).toBe("Ersatzteile (AT)");
    expect(localizeIn(name, "fr-FR")).toBe("Spare Parts");
    expect(localizeIn({ "nl-NL": "Onderdelen" }, "fr-FR")).toBe("Onderdelen");
    expect(localizeIn(undefined)).toBe("");
  });
});

describe("dictionary", () => {
  it("has every key in every language, with the same placeholders", () => {
    const keys = Object.keys(DICTIONARIES.en);
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const [lang, dict] of Object.entries(DICTIONARIES)) {
      expect(Object.keys(dict).sort(), lang).toEqual([...keys].sort());
      for (const k of keys)
        expect(holes(dict[k as keyof typeof dict]), `${lang} ${k}`).toBe(holes(DICTIONARIES.en[k as keyof typeof dict]));
    }
  });
  it("fills placeholders and falls back to English", () => {
    expect(t("pdp.inStock", { count: 3 }, "de-DE")).toBe("Auf Lager · 3 verfügbar");
    expect(t("cart.add", {}, "it-IT")).toBe("Add to cart");
    expect(t("pdp.moreIn", {}, "en-US")).toBe("More in {category}");
  });
});
