// Span names and attributes for commercetools calls (OpenTelemetry, docs/features/quality-gates.md), pure and
// unit-tested. A span name groups calls of one kind, so ids, keys and emails never go into it: UUIDs become {id},
// `key=<value>` becomes key={key}, and the project key {project}. Query values (where predicates hold emails and
// customer ids) are never recorded, only the parameter names.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Segments that are always followed by a caller-chosen value (a key, an email in a token request, a container name).
const VALUE_AFTER = new Set(["key=", "container", "in-business-unit", "as-associate", "password-token", "email-token"]);

export function routeOf(pathname: string, projectKey?: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = decodeURIComponent(parts[i]);
    if (i === 0 && projectKey && part === projectKey) out.push("{project}");
    else if (UUID.test(part)) out.push("{id}");
    else if (part.startsWith("key=")) out.push("key={key}");
    else if (part.startsWith("id=")) out.push("id={id}");
    else if (out.length > 0 && VALUE_AFTER.has(parts[i - 1]) && !UUID.test(part)) out.push("{value}");
    else if (/^\d+$/.test(part) || part.length > 40) out.push("{value}");
    else out.push(part);
  }
  return `/${out.join("/")}`;
}

// Custom objects are /custom-objects/<container>/<key>: both are values.
const customObjects = (route: string) =>
  route.replace(/\/custom-objects\/[^/]+(\/[^/]+)?/, (_m, key) => `/custom-objects/{container}${key ? "/{key}" : ""}`);

export function spanName(method: string, url: URL, projectKey?: string): string {
  return `commercetools ${method.toUpperCase()} ${customObjects(routeOf(url.pathname, projectKey))}`;
}

export function spanAttributes(method: string, url: URL, projectKey?: string): Record<string, string> {
  const params = [...new Set(url.searchParams.keys())].sort().join(",");
  return {
    "http.request.method": method.toUpperCase(),
    "server.address": url.hostname,
    "url.template": customObjects(routeOf(url.pathname, projectKey)),
    ...(params && { "commercetools.query_params": params }),
  };
}
