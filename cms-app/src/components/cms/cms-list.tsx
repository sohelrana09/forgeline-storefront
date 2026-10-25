import {
  Link as RouterLink,
  Switch,
  useHistory,
  useRouteMatch,
} from 'react-router-dom';
import { SuspendedRoute } from '@commercetools-frontend/application-shell';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import DataTable from '@commercetools-uikit/data-table';
import { usePaginationState } from '@commercetools-uikit/hooks';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import { Pagination } from '@commercetools-uikit/pagination';
import PrimaryButton from '@commercetools-uikit/primary-button';
import Spacings from '@commercetools-uikit/spacings';
import Stamp from '@commercetools-uikit/stamp';
import Text from '@commercetools-uikit/text';
import {
  PERMISSIONS,
  PLACEMENT_LABELS,
  type TContentKind,
} from '../../constants';
import { getErrorMessage } from '../../helpers';
import { useCmsObjects, type TCmsObject } from '../../hooks/use-cms-connector';
import BlockDetails from './block-details';
import PageDetails from './page-details';

const COLUMNS = {
  blocks: [
    { key: 'key', label: 'Identifier' },
    { key: 'title', label: 'Title' },
    { key: 'placement', label: 'Placement' },
    { key: 'type', label: 'Type' },
    { key: 'active', label: 'Status' },
    { key: 'lastModifiedAt', label: 'Last modified' },
  ],
  pages: [
    { key: 'key', label: 'URL key' },
    { key: 'title', label: 'Title' },
    { key: 'active', label: 'Status' },
    { key: 'lastModifiedAt', label: 'Last modified' },
  ],
};

const TITLES = {
  blocks: {
    headline: 'Content blocks',
    hint: 'Static blocks shown on the homepage, category, product and cart pages.',
    add: 'Add block',
  },
  pages: {
    headline: 'Content pages',
    hint: 'Pages published at /pages/<URL key> and linked in the storefront footer.',
    add: 'Add page',
  },
};

const CmsList = ({ kind }: { kind: TContentKind }) => {
  const match = useRouteMatch();
  const { push } = useHistory();
  const { page, perPage } = usePaginationState();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.Manage],
  });
  const { result, error, loading } = useCmsObjects(kind, {
    page: page.value,
    perPage: perPage.value,
  });
  const Details = kind === 'blocks' ? BlockDetails : PageDetails;
  const close = () => push(match.url);

  if (error) {
    return (
      <ContentNotification type="error">
        <Text.Body>{getErrorMessage(error)}</Text.Body>
      </ContentNotification>
    );
  }

  return (
    <Spacings.Stack scale="xl">
      <Spacings.Inline justifyContent="space-between" alignItems="flex-end">
        <Spacings.Stack scale="xs">
          <Text.Headline as="h2">{TITLES[kind].headline}</Text.Headline>
          <Text.Detail tone="secondary">{TITLES[kind].hint}</Text.Detail>
        </Spacings.Stack>
        {canManage && (
          <PrimaryButton
            as={RouterLink}
            to={`${match.url}/new`}
            label={TITLES[kind].add}
          />
        )}
      </Spacings.Inline>

      {loading && !result && <LoadingSpinner />}

      {result && (
        <Spacings.Stack scale="l">
          {result.results.length === 0 ? (
            <ContentNotification type="info">
              <Text.Body>Nothing here yet.</Text.Body>
            </ContentNotification>
          ) : (
            <DataTable<TCmsObject>
              isCondensed
              columns={COLUMNS[kind]}
              rows={result.results}
              itemRenderer={(item, column) => {
                const v = item.value;
                switch (column.key) {
                  case 'key':
                    return item.key;
                  case 'title':
                    return typeof v.title === 'string' ? v.title : '';
                  case 'placement':
                    return (
                      PLACEMENT_LABELS[
                        v.placement as keyof typeof PLACEMENT_LABELS
                      ] ?? String(v.placement ?? '')
                    );
                  case 'type':
                    return v.type === 'products'
                      ? 'Products'
                      : v.type === 'banner'
                      ? 'Banner'
                      : 'Text';
                  case 'active':
                    return v.active === false ? (
                      <Stamp tone="secondary" label="Inactive" />
                    ) : (
                      <Stamp tone="positive" label="Active" />
                    );
                  case 'lastModifiedAt':
                    return new Date(item.lastModifiedAt).toLocaleString();
                  default:
                    return null;
                }
              }}
              onRowClick={(row) => push(`${match.url}/${row.key}`)}
            />
          )}
          <Pagination
            page={page.value}
            onPageChange={page.onChange}
            perPage={perPage.value}
            onPerPageChange={perPage.onChange}
            totalItems={result.total}
            perPageRange="s"
          />
        </Spacings.Stack>
      )}

      <Switch>
        <SuspendedRoute path={`${match.url}/new`}>
          <Details isNew onClose={close} />
        </SuspendedRoute>
        <SuspendedRoute path={`${match.url}/:key`}>
          <Details onClose={close} />
        </SuspendedRoute>
      </Switch>
    </Spacings.Stack>
  );
};
CmsList.displayName = 'CmsList';

export default CmsList;
