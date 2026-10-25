/// <reference path="../../../@types-extensions/graphql-ctp/index.d.ts" />

import type { ApolloError } from '@apollo/client';
import {
  useMcLazyQuery,
  useMcMutation,
  useMcQuery,
} from '@commercetools-frontend/application-shell';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import { CONTAINERS, type TContentKind } from '../../constants';
import { useStorefrontRefresh } from '../use-storefront-refresh';
import DeleteCmsObjectMutation from './delete-cms-object.ctp.graphql';
import FetchCmsObjectQuery from './fetch-cms-object.ctp.graphql';
import FetchCmsObjectsQuery from './fetch-cms-objects.ctp.graphql';
import SaveCmsObjectMutation from './save-cms-object.ctp.graphql';

// A Custom Object as returned by GraphQL: `value` is already parsed JSON.
export type TCmsObject = {
  id: string;
  key: string;
  version: number;
  value: Record<string, unknown>;
  lastModifiedAt: string;
};

const context = { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM };

export const useCmsObjects = (
  kind: TContentKind,
  { page, perPage }: { page: number; perPage: number }
): {
  result?: { total: number; results: TCmsObject[] };
  error?: ApolloError;
  loading: boolean;
} => {
  const { data, error, loading } = useMcQuery<{
    customObjects: { total: number; results: TCmsObject[] };
  }>(FetchCmsObjectsQuery, {
    variables: {
      container: CONTAINERS[kind],
      limit: perPage,
      offset: (page - 1) * perPage,
    },
    context,
    fetchPolicy: 'cache-and-network',
  });
  return { result: data?.customObjects, error, loading };
};

export const useCmsObject = (
  kind: TContentKind,
  key?: string
): { object?: TCmsObject | null; error?: ApolloError; loading: boolean } => {
  const { data, error, loading } = useMcQuery<{
    customObject: TCmsObject | null;
  }>(FetchCmsObjectQuery, {
    variables: { container: CONTAINERS[kind], key },
    skip: !key,
    context,
    fetchPolicy: 'network-only',
  });
  return { object: data?.customObject, error, loading };
};

// For "new" forms: is this key already taken? (createOrUpdate would otherwise silently overwrite it.)
export const useCmsKeyCheck = (kind: TContentKind) => {
  const [fetch] = useMcLazyQuery<{ customObject: TCmsObject | null }>(
    FetchCmsObjectQuery,
    {
      context,
      fetchPolicy: 'network-only',
    }
  );
  return async (key: string) => {
    const { data } = await fetch({
      variables: { container: CONTAINERS[kind], key },
    });
    return Boolean(data?.customObject);
  };
};

export const useCmsSave = (kind: TContentKind) => {
  const refreshStorefront = useStorefrontRefresh();
  const [save, { loading }] = useMcMutation<{
    createOrUpdateCustomObject: TCmsObject;
  }>(SaveCmsObjectMutation, {
    context,
    refetchQueries: ['FetchCmsObjects'],
  });
  return {
    loading,
    // `version` makes edits optimistic-concurrency safe: a stale form gets a 409 instead of overwriting.
    execute: async (
      key: string,
      value: Record<string, unknown>,
      version?: number
    ) => {
      const { data } = await save({
        variables: {
          draft: {
            container: CONTAINERS[kind],
            key,
            value: JSON.stringify(value),
            version,
          },
        },
      });
      void refreshStorefront();
      return data?.createOrUpdateCustomObject;
    },
  };
};

export const useCmsDelete = () => {
  const refreshStorefront = useStorefrontRefresh();
  const [remove, { loading }] = useMcMutation(DeleteCmsObjectMutation, {
    context,
    refetchQueries: ['FetchCmsObjects'],
  });
  return {
    loading,
    execute: async (id: string, version: number) => {
      const result = await remove({ variables: { id, version } });
      void refreshStorefront();
      return result;
    },
  };
};
