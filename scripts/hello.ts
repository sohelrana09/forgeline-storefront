// Smoke test: confirms credentials work and shows what's in the project.
import { apiRoot, projectKey } from "../src/lib/commercetools/client";

async function main() {
  const project = (await apiRoot.get().execute()).body;
  console.log(`Connected to "${project.name}" (${projectKey})`);
  console.log(`Currencies: ${project.currencies.join(", ")} | Countries: ${project.countries.join(", ")}`);

  const products = (
    await apiRoot
      .productProjections()
      .get({ queryArgs: { limit: 5 } })
      .execute()
  ).body;
  console.log(`\nProducts: ${products.total ?? products.count}`);
  for (const p of products.results) {
    console.log(`  - ${Object.values(p.name)[0]} [${p.key ?? p.id}]`);
  }

  const units = (
    await apiRoot
      .businessUnits()
      .get({ queryArgs: { limit: 5 } })
      .execute()
  ).body;
  console.log(`\nBusiness units: ${units.total ?? units.count}`);
  for (const bu of units.results) {
    console.log(`  - ${bu.name} [${bu.key}] (${bu.unitType})`);
  }
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
