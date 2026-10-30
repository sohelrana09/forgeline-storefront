// Whether an error is a redirect() thrown by Next (a revoked session sends the visitor to /logout this way). Catch
// blocks that must let every Next signal through (redirect, notFound, prerender bailouts) call unstable_rethrow from
// next/navigation instead; this check is only for the few places that deliberately swallow a redirect. It reads the
// error's digest, the same check Next makes, without importing Next's private modules.
export function isRedirect(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;");
}
