"use client";

import { useEffect, useMemo, useState } from "react";
import { set, unset, type ArrayOfPrimitivesInputProps } from "sanity";
import { Box, Button, Card, Flex, Stack, Text, TextInput } from "@sanity/ui";
import { CloseIcon } from "@sanity/icons/Close";
import { SearchIcon } from "@sanity/icons/Search";
import { storefrontUrl } from "@/studio/storefront";

// Stores commercetools category slugs; the list comes from the storefront's /api/catalog/categories.
type Category = { slug: string; path: string };

export function CategoryPickerInput(props: ArrayOfPrimitivesInputProps) {
  const { value, onChange, readOnly } = props;
  const selected = useMemo(() => (value ?? []).filter((v): v is string => typeof v === "string"), [value]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${storefrontUrl}/api/catalog/categories`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ categories: Category[] }>) : { categories: [] }))
      .then((data) => setCategories(data.categories))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const pathOf = (slug: string) => categories.find((c) => c.slug === slug)?.path ?? slug;
  const save = (next: string[]) => onChange(next.length ? set(next) : unset());
  const q = query.trim().toLowerCase();
  const matches = q.length >= 2 ? categories.filter((c) => !selected.includes(c.slug) && c.path.toLowerCase().includes(q)).slice(0, 8) : [];

  return (
    <Stack gap={2}>
      {selected.map((slug) => (
        <Card key={slug} padding={2} radius={2} border>
          <Flex align="center" gap={2}>
            <Box flex={1}>
              <Text size={1}>{pathOf(slug)}</Text>
            </Box>
            {!readOnly && <Button icon={CloseIcon} mode="bleed" title="Remove" onClick={() => save(selected.filter((s) => s !== slug))} />}
          </Flex>
        </Card>
      ))}
      {!readOnly && (
        <TextInput icon={SearchIcon} placeholder="Add a category" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      )}
      {matches.length > 0 && (
        <Card radius={2} border>
          <Stack>
            {matches.map((c) => (
              <Button
                key={c.slug}
                mode="bleed"
                padding={2}
                text={c.path}
                onClick={() => {
                  save([...selected, c.slug]);
                  setQuery("");
                }}
              />
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
