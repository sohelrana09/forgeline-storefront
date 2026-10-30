// Company-shared purchase lists (E22 T22.8): gives the buyer-assignable associate roles the shopping-list permissions
// the storefront checks. Personal lists (/me) need none of these; company lists (as-associate) need them all.
//   npm run ct:seed-list-permissions            dry run: prints what each role would get
//   npm run ct:seed-list-permissions -- --yes   adds the missing permissions
//   npm run ct:seed-list-permissions -- --remove [--yes]   takes them away again
// Idempotent: only missing permissions are added (or present ones removed); one update per role, retried on 409.
// The roles are project-wide, so this applies to every business unit.
import type { AssociateRoleUpdateAction, Permission } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const remove = args.includes("--remove");

const MY: Permission[] = ["CreateMyShoppingLists", "ViewMyShoppingLists", "UpdateMyShoppingLists", "DeleteMyShoppingLists"];
// Buyers keep their own company lists and see their colleagues'; admins also change and delete anyone's.
const PLAN: Record<string, Permission[]> = {
  buyer: [...MY, "ViewOthersShoppingLists"],
  admin: [...MY, "ViewOthersShoppingLists", "UpdateOthersShoppingLists", "DeleteOthersShoppingLists"],
};
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;

async function apply(key: string, wanted: Permission[]) {
  for (let attempt = 1; ; attempt++) {
    const { body: role } = await apiRoot.associateRoles().withKey({ key }).get().execute();
    if (!role.buyerAssignable) throw new Error(`Role ${key} is not buyer-assignable; leaving it alone`);
    const has = new Set(role.permissions);
    const changes = remove ? wanted.filter((p) => has.has(p)) : wanted.filter((p) => !has.has(p));
    if (changes.length === 0) return console.log(`= ${key}: ${remove ? "none of them" : "has all"} (${wanted.join(", ")})`);
    const sign = remove ? "-" : "+";
    if (!yes) return console.log(`${sign} ${key} would ${remove ? "lose" : "get"}: ${changes.join(", ")}`);
    const actions: AssociateRoleUpdateAction[] = changes.map((permission) =>
      remove ? { action: "removePermission", permission } : { action: "addPermission", permission },
    );
    try {
      await apiRoot
        .associateRoles()
        .withKey({ key })
        .post({ body: { version: role.version, actions } })
        .execute();
      return console.log(`${sign} ${key}: ${changes.join(", ")}`);
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 2) throw err;
    }
  }
}

async function main() {
  for (const [key, wanted] of Object.entries(PLAN)) await apply(key, wanted);
  if (!yes) console.log("Dry run: add --yes to change the roles.");
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
