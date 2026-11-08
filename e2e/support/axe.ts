import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// WCAG 2.1 A and AA checks with axe-core (docs/features/quality-gates.md). Every violation fails the test, with the
// rule, its impact and the first elements in the message, so a regression shows what to fix.
// Excluded: the Next.js dev overlay (development only) and third-party frames (payment forms, which their vendors test).
export async function expectAccessible(page: Page, { exclude = [] as string[] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("nextjs-portal").exclude("iframe");
  for (const selector of exclude) builder = builder.exclude(selector);
  const { violations } = await builder.analyze();
  const report = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join("\n  ")}`,
  );
  expect(report, report.join("\n")).toEqual([]);
}
