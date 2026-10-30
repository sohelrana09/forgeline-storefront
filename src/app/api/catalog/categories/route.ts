import { NextResponse, connection } from "next/server";
import { getCategoryTree } from "@/features/catalog/service";
import { localize } from "@/features/catalog/utils";

// Category slugs and paths for the Studio's category picker (public catalog data, like the menu).
export async function GET() {
  // Answered per request (from the cached tree), not frozen at build time.
  await connection();
  try {
    const tree = await getCategoryTree();
    const categories = tree.all
      .map((c) => ({ slug: localize(c.slug), path: [...tree.ancestors(c), c].map((x) => localize(x.name)).join(" › ") }))
      .sort((a, b) => a.path.localeCompare(b.path));
    return NextResponse.json({ categories }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.error("category list failed", (err as { body?: unknown })?.body ?? err);
    return NextResponse.json({ categories: [] }, { status: 503 });
  }
}
