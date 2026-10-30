import { describe, expect, it } from "vitest";
import { codeWords, distance, fold, rank, words, type SearchEntry } from "@/features/catalog/search";

const entry = (name: string, sku: string, extra: Partial<SearchEntry> = {}): SearchEntry => ({
  id: sku,
  name,
  slug: sku,
  sku,
  nameWords: words(name),
  codes: codeWords(sku),
  categories: [],
  attributes: [],
  description: [],
  ...extra,
});

const index = [
  entry("Wheeled Excavator JJ234", "jj234-wx", { categories: ["excavators"] }),
  entry("Compact Loader S567 UV", "s567-uv", { categories: ["loaders"], description: words("Handles pallets with ease") }),
  entry("Hydraulic Pump", "hp-100", { categories: ["spare", "parts"], attributes: ["hydraulic"] }),
  entry("Pump Seal Kit", "sk-200", { categories: ["spare", "parts"], description: words("Fits the hydraulic pump") }),
];
const names = (q: string) => rank(index, q).matches.map((e) => e.name);

describe("fold and words", () => {
  it("drops accents and case", () => expect(fold("Grúa ÉLÉVATRICE")).toBe("grua elevatrice"));
  it("splits on anything that isn't a letter or digit", () => expect(words("S567-UV / jj_234")).toEqual(["s567", "uv", "jj", "234"]));
});

describe("codeWords", () => {
  it("knows the dashed, compact and letters-only forms", () => expect(codeWords("S567-UV")).toEqual(["s567", "uv", "s567uv", "suv"]));
  it("skips a letters-only form that equals the compact one", () => expect(codeWords("ABC")).toEqual(["abc"]));
  it("skips a single letter", () => expect(codeWords("A100")).toEqual(["a100"]));
});

describe("distance", () => {
  it("counts a swap of neighbours as one edit", () => expect(distance("pmup", "pump", 2)).toBe(1));
  it("stops past the limit", () => expect(distance("abcdef", "uvwxyz", 1)).toBe(2));
  it("is zero for equal words", () => expect(distance("loader", "loader", 1)).toBe(0));
});

describe("rank", () => {
  it("returns nothing for an empty query", () => expect(rank(index, "  - ").matches).toEqual([]));

  it("finds by name, SKU and letters-only model code", () => {
    expect(names("excavator")).toEqual(["Wheeled Excavator JJ234"]);
    expect(names("jj234wx")).toEqual(["Wheeled Excavator JJ234"]);
    expect(names("suv")).toEqual(["Compact Loader S567 UV"]);
  });

  it("needs every word to match", () => {
    expect(names("hydraulic pump")).toEqual(["Hydraulic Pump", "Pump Seal Kit"]);
    expect(names("hydraulic loader")).toEqual([]);
  });

  it("ranks a name match above a description match", () => expect(names("pump")[0]).toBe("Hydraulic Pump"));

  it("matches inside a word only from three letters", () => {
    expect(names("allet")).toEqual(["Compact Loader S567 UV"]);
    expect(names("ll")).toEqual([]);
  });

  it("corrects a typo and says what it used", () => {
    const result = rank(index, "excavtor");
    expect(result.matches.map((e) => e.name)).toEqual(["Wheeled Excavator JJ234"]);
    expect(result.corrected).toBe("excavator");
  });

  it("doesn't go fuzzy when the word matches as typed", () => {
    const result = rank(index, "pump");
    expect(result.corrected).toBeUndefined();
  });

  it("allows no typo in short words", () => expect(names("pmp")).toEqual([]));
});
