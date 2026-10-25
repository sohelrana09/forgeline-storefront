"use client";

// Last-resort boundary for errors in the root layout itself. It replaces the root layout, so it needs <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>Something went wrong</h1>
        <p>Ironline Supply couldn&apos;t be loaded. Please try again.</p>
        <button onClick={reset} style={{ minHeight: 44, padding: "0 1.25rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
