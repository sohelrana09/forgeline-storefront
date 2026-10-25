import { useState, type ReactNode } from 'react';
import { useFormik, type FormikErrors } from 'formik';
import { useParams } from 'react-router-dom';
import {
  useShowApiErrorNotification,
  useShowNotification,
} from '@commercetools-frontend/actions-global';
import {
  ConfirmationDialog,
  CustomFormModalPage,
  PageNotFound,
} from '@commercetools-frontend/application-components';
import { DOMAINS } from '@commercetools-frontend/constants';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import Text from '@commercetools-uikit/text';
import { PERMISSIONS, type TContentKind } from '../../constants';
import { getErrorMessage } from '../../helpers';
import type { ApolloError } from '@apollo/client';
import {
  useCmsDelete,
  useCmsKeyCheck,
  useCmsObject,
  useCmsSave,
} from '../../hooks/use-cms-connector';

const errorText = (err: unknown) =>
  err && typeof err === 'object' && 'graphQLErrors' in err
    ? getErrorMessage(err as ApolloError)
    : String((err as Error)?.message ?? err);

export type TEditorProps = { isNew?: boolean; onClose: () => void };

type TFormBase = { key: string };
type TEditorConfig<F extends TFormBase> = TEditorProps & {
  kind: TContentKind;
  noun: string;
  toForm: (key?: string, value?: Record<string, unknown>) => F;
  fromForm: (values: F) => Record<string, unknown>;
  // UI Kit field errors are { [message]: true }, which Formik's string-based error type doesn't model.
  validate: (values: F) => object;
  renderFields: (
    formik: ReturnType<typeof useFormik<F>>,
    options: { isReadOnly: boolean; isNew: boolean }
  ) => ReactNode;
};

// Load → edit → save (with version) / delete one CMS Custom Object, in a Merchant Center modal page.
function CmsEditor<F extends TFormBase>(props: TEditorConfig<F>) {
  const { key } = useParams<{ key?: string }>();
  const isNew = Boolean(props.isNew);
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.Manage],
  });
  const { object, error, loading } = useCmsObject(
    props.kind,
    isNew ? undefined : key
  );
  const save = useCmsSave(props.kind);
  const remove = useCmsDelete();
  const keyTaken = useCmsKeyCheck(props.kind);
  const showNotification = useShowNotification();
  const showApiErrorNotification = useShowApiErrorNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formik = useFormik<F>({
    initialValues: props.toForm(object?.key, object?.value),
    enableReinitialize: true,
    validate: (values) => props.validate(values) as FormikErrors<F>,
    onSubmit: async (values, helpers) => {
      if (isNew && (await keyTaken(values.key))) {
        helpers.setErrors({
          key: { [`"${values.key}" is already used`]: true },
        } as unknown as FormikErrors<F>);
        return;
      }
      try {
        await save.execute(values.key, props.fromForm(values), object?.version);
        showNotification({
          kind: 'success',
          domain: DOMAINS.SIDE,
          text: `${props.noun} "${values.key}" saved`,
        });
        props.onClose();
      } catch (err) {
        // A 409 here means someone else saved this item since it was opened.
        showApiErrorNotification({
          errors: [{ message: errorText(err) }] as never,
        });
      }
    },
  });

  if (!isNew && !loading && !error && object === null) return <PageNotFound />;
  const isReadOnly = !canManage;

  return (
    <CustomFormModalPage
      title={
        isNew ? `New ${props.noun.toLowerCase()}` : `${props.noun}: ${key}`
      }
      isOpen
      onClose={props.onClose}
      formControls={
        <>
          <CustomFormModalPage.FormSecondaryButton
            label={CustomFormModalPage.Intl.revert}
            onClick={() => formik.resetForm()}
            isDisabled={!formik.dirty || formik.isSubmitting}
          />
          {!isNew && canManage && (
            <CustomFormModalPage.FormDeleteButton
              onClick={() => setConfirmDelete(true)}
              isDisabled={formik.isSubmitting || remove.loading}
            />
          )}
          <CustomFormModalPage.FormPrimaryButton
            label={CustomFormModalPage.Intl.save}
            onClick={() => formik.handleSubmit()}
            isDisabled={isReadOnly || !formik.dirty || formik.isSubmitting}
          />
        </>
      }
    >
      {loading && !object && <LoadingSpinner />}
      {error && (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      )}
      {(isNew || object) && props.renderFields(formik, { isReadOnly, isNew })}

      <ConfirmationDialog
        title={`Delete ${props.noun.toLowerCase()} "${key}"?`}
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!object) return;
          try {
            await remove.execute(object.id, object.version);
            showNotification({
              kind: 'success',
              domain: DOMAINS.SIDE,
              text: `${props.noun} "${key}" deleted`,
            });
            setConfirmDelete(false);
            props.onClose();
          } catch (err) {
            showApiErrorNotification({
              errors: [{ message: errorText(err) }] as never,
            });
          }
        }}
      >
        <Text.Body>
          It disappears from the storefront within a minute. This can't be
          undone.
        </Text.Body>
      </ConfirmationDialog>
    </CustomFormModalPage>
  );
}

export default CmsEditor;
