import CheckboxInput from '@commercetools-uikit/checkbox-input';
import Spacings from '@commercetools-uikit/spacings';
import TextField from '@commercetools-uikit/text-field';
import MarkdownEditor from '../markdown/markdown-editor';
import CmsEditor, { type TEditorProps } from './cms-editor';
import {
  formToPage,
  pageToForm,
  validatePage,
  type TPageForm,
} from './conversions';

const showMessage = (errorKey: string) => errorKey;

const PageDetails = (props: TEditorProps) => (
  <CmsEditor<TPageForm>
    {...props}
    kind="pages"
    noun="Page"
    toForm={pageToForm}
    fromForm={formToPage}
    validate={validatePage}
    renderFields={(formik, { isReadOnly, isNew }) => {
      const field = (name: keyof TPageForm) => ({
        name,
        errors: (formik.errors[name] ?? undefined) as
          | Record<string, boolean>
          | undefined,
        touched: Boolean(formik.touched[name]),
        onChange: formik.handleChange,
        onBlur: formik.handleBlur,
        isReadOnly,
        renderError: showMessage,
        horizontalConstraint: 16 as const,
      });
      return (
        <Spacings.Stack scale="l">
          <TextField
            {...field('key')}
            title="URL key"
            description="The page is published at /pages/<URL key>. Can't be changed later."
            value={formik.values.key}
            isReadOnly={isReadOnly || !isNew}
            isRequired
          />
          <TextField
            {...field('title')}
            title="Title"
            value={formik.values.title}
            isRequired
          />
          <TextField
            {...field('metaDescription')}
            title="Meta description"
            description="Shown by search engines."
            value={formik.values.metaDescription}
          />
          <CheckboxInput
            name="active"
            isChecked={formik.values.active}
            isReadOnly={isReadOnly}
            onChange={(e) => formik.setFieldValue('active', e.target.checked)}
          >
            Active (published and linked in the footer)
          </CheckboxInput>
          <MarkdownEditor
            name="content"
            title="Content"
            description="Use the toolbar or Markdown, including tables and images from the media library. HTML is not shown on the storefront."
            value={formik.values.content}
            onChange={(v) => formik.setFieldValue('content', v)}
            onBlur={() => formik.setFieldTouched('content')}
            isReadOnly={isReadOnly}
            isRequired
            errors={field('content').errors}
            touched={field('content').touched}
          />
        </Spacings.Stack>
      );
    }}
  />
);
PageDetails.displayName = 'PageDetails';

export default PageDetails;
