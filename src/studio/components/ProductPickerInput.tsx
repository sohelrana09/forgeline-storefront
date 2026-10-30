"use client";

import { useEffect, useState } from "react";
import { set, setIfMissing, unset, type ObjectInputProps } from "sanity";
import { Box, Button, Card, Flex, Spinner, Stack, Text, TextInput } from "@sanity/ui";
import { CloseIcon } from "@sanity/icons/Close";
import { SearchIcon } from "@sanity/icons/Search";
import { storefrontUrl } from "@/studio/storefront";

// commercetools product picker for the Studio. It searches the storefront's own suggestion endpoint
// (/api/search/suggest, guest catalog, same origin as the embedded Studio), so the Studio never holds commercetools
// credentials. Only the SKU matters; name and picture just label the choice.
type Value = { sku?: string; name?: string; image?: string };
type Suggestion = { label: string; detail?: string; image?: string };

export function ProductPickerInput(props: ObjectInputProps<Value>) {
  const { value, onChange, readOnly, schemaType } = props;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`${storefrontUrl}/api/search/suggest?${new URLSearchParams({ q })}`, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ products?: Suggestion[] }>) : { products: [] }))
        .then((data) => setResults((data.products ?? []).filter((p) => p.detail)))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const choose = (p: Suggestion) => {
    onChange([
      setIfMissing({ _type: schemaType.name }),
      set(p.detail, ["sku"]),
      set(p.label, ["name"]),
      p.image ? set(p.image, ["image"]) : unset(["image"]),
    ]);
    setQuery("");
  };

  if (value?.sku) {
    return (
      <Card padding={2} radius={2} border>
        <Flex align="center" gap={3}>
          {value.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.image} alt="" width={40} height={40} style={{ objectFit: "contain" }} />
          )}
          <Stack gap={2} flex={1}>
            <Text size={1} weight="semibold">
              {value.name ?? value.sku}
            </Text>
            <Text size={1} muted>
              SKU {value.sku}
            </Text>
          </Stack>
          {!readOnly && (
            <Button
              icon={CloseIcon}
              mode="bleed"
              title="Choose another product"
              onClick={() => onChange([unset(["sku"]), unset(["name"]), unset(["image"])])}
            />
          )}
        </Flex>
      </Card>
    );
  }

  const shown = query.trim().length >= 2 ? results : [];
  return (
    <Stack gap={2}>
      <TextInput
        icon={SearchIcon}
        iconRight={loading ? Spinner : undefined}
        placeholder="Search the catalog by name or SKU"
        value={query}
        readOnly={readOnly}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      {shown.length > 0 && (
        <Card radius={2} border>
          <Stack>
            {shown.map((p) => (
              <Button key={p.detail} mode="bleed" padding={2} onClick={() => choose(p)}>
                <Flex align="center" gap={3}>
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" width={32} height={32} style={{ objectFit: "contain" }} />
                  )}
                  <Box flex={1}>
                    <Text size={1}>{p.label}</Text>
                  </Box>
                  <Text size={1} muted>
                    {p.detail}
                  </Text>
                </Flex>
              </Button>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
