// A string value for a commercetools `where` predicate, quoted and escaped (keys come from commercetools data
// today, but a quote in one must never change the predicate).
export const str = (value: string) => `"${value.replace(/["\\]/g, "\\$&")}"`;
