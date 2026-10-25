/// <reference path="../../../@types-extensions/graphql-ctp/index.d.ts" />

import { useCallback, useState } from 'react';
import type { ApolloError } from '@apollo/client';
import {
  buildApiUrl,
  executeHttpClientRequest,
  useMcLazyQuery,
  useMcMutation,
  useMcQuery,
} from '@commercetools-frontend/application-shell';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import {
  MAX_IMAGE_WIDTH,
  MAX_UPLOAD_BYTES,
  MEDIA_PRODUCT_KEY,
  MEDIA_SKU,
  UPLOAD_TYPES,
} from '../../constants';
import FetchMediaLibraryQuery from './fetch-media-library.ctp.graphql';
import FetchMediaUsageQuery from './fetch-media-usage.ctp.graphql';
import RemoveMediaImageMutation from './remove-media-image.ctp.graphql';

export type TMediaImage = {
  url: string;
  label?: string | null;
  dimensions: { width: number; height: number };
};

type TMediaProduct = {
  id: string;
  version: number;
  masterData: { staged: { masterVariant: { images: TMediaImage[] } } };
};

const context = { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM };

// The media library: images of the hidden "cms-media-library" product, newest first.
export const useMediaLibrary = (): {
  images: TMediaImage[];
  productId?: string;
  error?: ApolloError;
  loading: boolean;
  refetch: () => Promise<unknown>;
} => {
  const { data, error, loading, refetch } = useMcQuery<{
    product: TMediaProduct | null;
  }>(FetchMediaLibraryQuery, {
    variables: { key: MEDIA_PRODUCT_KEY },
    context,
    fetchPolicy: 'cache-and-network',
  });
  const images = [
    ...(data?.product?.masterData.staged.masterVariant.images ?? []),
  ].reverse();
  return { images, productId: data?.product?.id, error, loading, refetch };
};

type TUsage = Record<
  'blocks' | 'pages',
  { results: { key: string; value: unknown }[] }
>;

// Deleting from the media library: where an image is still used (blocks and pages whose JSON mentions its URL),
// and removing it from the media product. The product's version is read fresh, and a version conflict (someone
// uploaded meanwhile) is retried once.
export const useMediaDelete = () => {
  const [fetchUsage] = useMcLazyQuery<TUsage>(FetchMediaUsageQuery, {
    context,
    fetchPolicy: 'network-only',
  });
  const [fetchProduct] = useMcLazyQuery<{ product: TMediaProduct | null }>(
    FetchMediaLibraryQuery,
    { context, fetchPolicy: 'network-only' }
  );
  const [remove] = useMcMutation(RemoveMediaImageMutation, { context });
  const [deleting, setDeleting] = useState(false);

  const usedBy = useCallback(
    async (url: string): Promise<string[]> => {
      const { data, error } = await fetchUsage();
      if (error || !data)
        throw new Error("Couldn't check where the image is used.");
      const mentions = (kind: string, list: TUsage['blocks']) =>
        list.results
          .filter((o) => JSON.stringify(o.value).includes(url))
          .map((o) => `${kind} ${o.key}`);
      return [
        ...mentions('Block', data.blocks),
        ...mentions('Page', data.pages),
      ];
    },
    [fetchUsage]
  );

  const deleteImage = useCallback(
    async (url: string) => {
      setDeleting(true);
      try {
        for (let attempt = 0; ; attempt++) {
          const { data } = await fetchProduct({
            variables: { key: MEDIA_PRODUCT_KEY },
          });
          if (!data?.product)
            throw new Error('The media library is not set up.');
          try {
            await remove({
              variables: {
                id: data.product.id,
                version: data.product.version,
                actions: [
                  {
                    removeImage: {
                      sku: MEDIA_SKU,
                      imageUrl: url,
                      staged: true,
                    },
                  },
                ],
              },
            });
            return;
          } catch (err) {
            if (attempt === 0 && /ConcurrentModification/i.test(String(err)))
              continue;
            throw err;
          }
        }
      } finally {
        setDeleting(false);
      }
    },
    [fetchProduct, remove]
  );

  return { usedBy, deleteImage, deleting };
};

// The upload API takes JPEG, PNG and GIF up to 10 MB. Anything else the browser can draw (WebP, AVIF, a huge
// photo) is converted to JPEG and scaled to at most MAX_IMAGE_WIDTH pixels wide first.
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/'))
    throw new Error('Choose an image file (JPEG, PNG, GIF or WebP).');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`This browser can't read ${file.name} as an image.`);
  });
  const fits =
    UPLOAD_TYPES.includes(file.type) &&
    file.size <= MAX_UPLOAD_BYTES &&
    bitmap.width <= MAX_IMAGE_WIDTH;
  if (fits) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx)
    throw new Error('Image conversion is not available in this browser.');
  // JPEG has no transparency: put transparent pixels on white.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  );
  if (!blob || blob.size > MAX_UPLOAD_BYTES)
    throw new Error('The image is too large to upload, even after resizing.');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
  });
}

const safeFilename = (name: string) =>
  name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80) || 'image';

// Uploads one image through the Merchant Center API's proxy to the commercetools product image endpoint, which
// stores it on the commercetools CDN. The signed-in user needs the app's Manage permission (manage_products).
export const useMediaUpload = (productId?: string) => {
  const projectKey = useApplicationContext((ctx) => ctx.project?.key);
  const [uploading, setUploading] = useState(false);
  const upload = useCallback(
    async (original: File): Promise<TMediaImage> => {
      if (!productId || !projectKey)
        throw new Error(
          'The media library is not set up. Run "npm run ct:media-library" in the storefront first.'
        );
      setUploading(true);
      try {
        const file = await prepareImage(original);
        const query = new URLSearchParams({
          sku: MEDIA_SKU,
          filename: safeFilename(file.name),
          staged: 'true',
        });
        const product = await executeHttpClientRequest<TUploadResponse>(
          async (options: RequestInit) => {
            const res = await fetch(
              buildApiUrl(
                `/proxy/ctp/${projectKey}/products/${productId}/images?${query}`
              ),
              {
                ...options,
                method: 'POST',
                headers: {
                  ...(options.headers as Record<string, string>),
                  'Content-Type': file.type,
                },
                body: file,
              }
            );
            const data = await res.json().catch(() => undefined);
            if (!res.ok)
              throw new Error(
                (data as { message?: string } | undefined)?.message ??
                  `Upload failed (HTTP ${res.status}).`
              );
            return {
              data: data as TUploadResponse,
              statusCode: res.status,
              getHeader: (key: string) => res.headers.get(key),
            };
          }
        );
        // commercetools appends a random suffix to the file name: find ours by its stem, since another upload may
        // have landed at the same time.
        const stem = safeFilename(file.name).replace(/\.[^.]+$/, '');
        const images = product.masterData.staged.masterVariant.images;
        const added =
          images
            .filter((img: { url: string }) =>
              img.url.split('/').pop()?.startsWith(`${stem}-`)
            )
            .pop() ?? images[images.length - 1];
        return {
          url: added.url,
          label: added.label,
          dimensions: { width: added.dimensions.w, height: added.dimensions.h },
        };
      } finally {
        setUploading(false);
      }
    },
    [productId, projectKey]
  );
  return { upload, uploading };
};

// REST product response (the upload endpoint answers with the whole product).
type TUploadResponse = {
  masterData: {
    staged: {
      masterVariant: {
        images: {
          url: string;
          label?: string;
          dimensions: { w: number; h: number };
        }[];
      };
    };
  };
};
