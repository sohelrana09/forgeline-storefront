import { describe, expect, it } from "vitest";
import { demoPassword, parseEnv, regionOf, regionUrls, setEnvValue, storefrontScopes } from "./lib";

describe("env files", () => {
  const text = `# a comment
CTP_PROJECT_KEY=my-shop
CTP_CLIENT_ID=
# REVALIDATE_SECRET=commented
MAIL_FROM="Shop <shop@example.com>"
`;

  it("reads values and skips comments and commented-out keys", () => {
    const env = parseEnv(text);
    expect(env.get("CTP_PROJECT_KEY")).toBe("my-shop");
    expect(env.get("CTP_CLIENT_ID")).toBe("");
    expect(env.has("REVALIDATE_SECRET")).toBe(false);
    expect(env.get("MAIL_FROM")).toBe("Shop <shop@example.com>");
  });

  it("replaces a value in place and appends a new one", () => {
    const filled = setEnvValue(text, "CTP_CLIENT_ID", "abc123");
    expect(filled).toContain("CTP_PROJECT_KEY=my-shop\nCTP_CLIENT_ID=abc123\n");
    const appended = setEnvValue(filled, "REVALIDATE_SECRET", "s3cret");
    expect(appended).toContain("# REVALIDATE_SECRET=commented");
    expect(appended.trimEnd().endsWith("REVALIDATE_SECRET=s3cret")).toBe(true);
    expect(parseEnv(appended).get("REVALIDATE_SECRET")).toBe("s3cret");
  });

  it("quotes values with spaces", () => {
    expect(parseEnv(setEnvValue("", "MAIL_FROM", "A B <a@b.c>")).get("MAIL_FROM")).toBe("A B <a@b.c>");
  });
});

describe("regions", () => {
  it("builds the auth and API hosts and reads the region back", () => {
    const urls = regionUrls("eu-central-1.aws");
    expect(urls).toEqual({
      CTP_AUTH_URL: "https://auth.eu-central-1.aws.commercetools.com",
      CTP_API_URL: "https://api.eu-central-1.aws.commercetools.com",
    });
    expect(regionOf(urls.CTP_API_URL)).toBe("eu-central-1.aws");
    expect(regionOf("http://localhost")).toBeUndefined();
  });
});

describe("storefront scopes", () => {
  it("lists project-wide and per-store scopes once each", () => {
    const scopes = storefrontScopes("p", ["spain", "default-store", "spain"]);
    expect(scopes).toEqual([
      "manage_my_profile:p",
      "manage_my_quote_requests:p",
      "manage_my_quotes:p",
      "create_anonymous_token:p",
      "manage_my_orders:p:default-store",
      "manage_my_orders:p:spain",
      "manage_my_shopping_lists:p:default-store",
      "manage_my_shopping_lists:p:spain",
    ]);
  });
});

describe("demo password", () => {
  it("is four readable groups of four", () => {
    const password = demoPassword(new Uint8Array(16).map((_, i) => i * 17));
    expect(password).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    expect(password).not.toMatch(/[0O1lI]/);
  });
  it("needs enough randomness", () => {
    expect(() => demoPassword(new Uint8Array(8))).toThrow();
  });
});
