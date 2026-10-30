import "server-only";

// CT_TRACE=1 logs every commercetools call with its duration, to find slow pages. Paths and query parameter names
// only: query values can hold emails or tokens.
export const traceFetch: typeof fetch = async (input, init) => {
  if (process.env.CT_TRACE !== "1") return fetch(input, init);
  const started = performance.now();
  const url = new URL(input instanceof Request ? input.url : String(input));
  try {
    return await fetch(input, init);
  } finally {
    const params = [...new Set(url.searchParams.keys())].join(",");
    const ms = Math.round(performance.now() - started);
    console.info(`[ct] ${String(ms).padStart(5)} ms ${init?.method ?? "GET"} ${url.pathname}${params ? ` ?${params}` : ""}`);
  }
};
