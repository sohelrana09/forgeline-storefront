import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import CheckboxInput from '@commercetools-uikit/checkbox-input';
import DateTimeField from '@commercetools-uikit/date-time-field';
import MultilineTextField from '@commercetools-uikit/multiline-text-field';
import SelectField from '@commercetools-uikit/select-field';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import { PLACEMENTS, PLACEMENT_LABELS } from '../../constants';
import CmsEditor, { type TEditorProps } from './cms-editor';
import ImageField from '../media/image-field';
import MarkdownEditor from '../markdown/markdown-editor';
import {
  blockToForm,
  formToBlock,
  validateBlock,
  type TBlockForm,
} from './conversions';

const placementOptions = PLACEMENTS.map((p) => ({
  value: p,
  label: PLACEMENT_LABELS[p],
}));
const styleOptions = [
  { value: 'plain', label: 'Plain (white box)' },
  { value: 'info', label: 'Info (blue)' },
  { value: 'promo', label: 'Promo (orange)' },
];
const typeOptions = [
  { value: 'markdown', label: 'Text (Markdown)' },
  { value: 'products', label: 'Products (list of SKUs)' },
  { value: 'banner', label: 'Banner (picture, headline, buttons)' },
];
const themeOptions = [
  { value: 'dark', label: 'White text on a darkened picture' },
  { value: 'light', label: 'Dark text on a lightened picture' },
];
const showMessage = (errorKey: string) => errorKey;

const BlockDetails = (props: TEditorProps) => {
  // Schedules are entered and shown in the merchant's own time zone, stored as UTC.
  const timeZone = useApplicationContext((ctx) => ctx.user?.timeZone) ?? 'UTC';
  return (
    <CmsEditor<TBlockForm>
      {...props}
      kind="blocks"
      noun="Block"
      toForm={blockToForm}
      fromForm={formToBlock}
      validate={validateBlock}
      renderFields={(formik, { isReadOnly, isNew }) => {
        const field = (name: keyof TBlockForm) => ({
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
              title="Identifier"
              description="Used in the storefront and in content/blocks/<identifier>.json. Can't be changed later."
              value={formik.values.key}
              isReadOnly={isReadOnly || !isNew}
              isRequired
            />
            <TextField
              {...field('title')}
              title="Title"
              description="Shown above product blocks; a label for the others."
              value={formik.values.title}
            />
            <CheckboxInput
              name="active"
              isChecked={formik.values.active}
              isReadOnly={isReadOnly}
              onChange={(e) => formik.setFieldValue('active', e.target.checked)}
            >
              Active (shown on the storefront)
            </CheckboxInput>
            <SelectField
              {...field('placement')}
              title="Placement"
              value={formik.values.placement}
              options={placementOptions}
              isRequired
            />
            <SelectField
              {...field('type')}
              title="Type"
              description={
                formik.values.placement === 'home.hero' &&
                formik.values.type !== 'banner'
                  ? 'The main banner placement shows Banner blocks only.'
                  : undefined
              }
              value={formik.values.type}
              options={typeOptions}
              isRequired
            />
            {formik.values.type !== 'banner' && (
              <SelectField
                {...field('style')}
                title="Style"
                value={formik.values.style}
                options={styleOptions}
              />
            )}
            {formik.values.type === 'markdown' ? (
              <MarkdownEditor
                name="content"
                title="Content"
                description="Use the toolbar or Markdown: **bold**, ## heading, - list, [link](/path). HTML is not shown on the storefront."
                value={formik.values.content}
                onChange={(v) => formik.setFieldValue('content', v)}
                onBlur={() => formik.setFieldTouched('content')}
                isReadOnly={isReadOnly}
                isRequired
                errors={field('content').errors}
                touched={field('content').touched}
              />
            ) : formik.values.type === 'banner' ? (
              <Spacings.Stack scale="l">
                <TextField
                  {...field('headline')}
                  title="Headline"
                  description="The banner's big line. Keep it under about 60 characters."
                  value={formik.values.headline}
                  isRequired
                />
                <MultilineTextField
                  {...field('content')}
                  title="Text"
                  description="One or two sentences under the headline (plain text)."
                  value={formik.values.content}
                />
                <ImageField
                  name="image"
                  title="Picture"
                  description="Wide picture, at least 1600 × 900 px. The left side sits under the text."
                  value={formik.values.image}
                  onChange={(url) => formik.setFieldValue('image', url)}
                  isReadOnly={isReadOnly}
                  isRequired
                  errors={field('image').errors}
                  touched={field('image').touched}
                />
                <ImageField
                  name="mobileImage"
                  title="Phone picture (optional)"
                  description="A narrower crop for phones. Without one, phones show the main picture."
                  value={formik.values.mobileImage}
                  onChange={(url) => formik.setFieldValue('mobileImage', url)}
                  isReadOnly={isReadOnly}
                  errors={field('mobileImage').errors}
                  touched={field('mobileImage').touched}
                />
                <TextField
                  {...field('imageAlt')}
                  title="Picture description"
                  description="What the picture shows, for screen readers and search engines. Leave empty if it is decoration."
                  value={formik.values.imageAlt}
                />
                <SelectField
                  {...field('theme')}
                  title="Text colour"
                  value={formik.values.theme}
                  options={themeOptions}
                  isRequired
                />
              </Spacings.Stack>
            ) : (
              <TextField
                {...field('skus')}
                title="SKUs"
                description="Product SKUs in display order, separated by commas, e.g. hydraulic-hose, alternator"
                value={formik.values.skus}
                isRequired
              />
            )}
            <Text.Subheadline as="h4">Targeting (optional)</Text.Subheadline>
            <TextField
              {...field('stores')}
              title="Only in stores"
              description="Store keys, comma separated. Empty means all stores."
              value={formik.values.stores}
            />
            <TextField
              {...field('categories')}
              title="Only in categories"
              description="Category slugs, comma separated (subcategories included). Empty means everywhere."
              value={formik.values.categories}
            />
            <TextField
              {...field('sortOrder')}
              title="Sort order"
              description="Lower numbers show first."
              value={formik.values.sortOrder}
            />
            <Text.Subheadline as="h4">Schedule (optional)</Text.Subheadline>
            <DateTimeField
              name="startsAt"
              title="Show from"
              description="Empty: from now. The storefront follows within about 6 minutes."
              value={formik.values.startsAt}
              onChange={(e) =>
                formik.setFieldValue('startsAt', e.target.value ?? '')
              }
              timeZone={timeZone}
              isReadOnly={isReadOnly}
              horizontalConstraint={8}
            />
            <DateTimeField
              name="endsAt"
              title="Show until"
              description="Empty: no end."
              value={formik.values.endsAt}
              onChange={(e) =>
                formik.setFieldValue('endsAt', e.target.value ?? '')
              }
              timeZone={timeZone}
              isReadOnly={isReadOnly}
              errors={field('endsAt').errors}
              touched
              renderError={showMessage}
              horizontalConstraint={8}
            />
            <Text.Subheadline as="h4">
              {formik.values.type === 'banner'
                ? 'Buttons (optional)'
                : 'Link button (optional)'}
            </Text.Subheadline>
            <TextField
              {...field('ctaLabel')}
              title="Button label"
              value={formik.values.ctaLabel}
            />
            <TextField
              {...field('ctaHref')}
              title="Button link"
              description='Starts with "/" (storefront page) or "https:"'
              value={formik.values.ctaHref}
            />
            {formik.values.type === 'banner' && (
              <>
                <TextField
                  {...field('cta2Label')}
                  title="Second button label"
                  value={formik.values.cta2Label}
                />
                <TextField
                  {...field('cta2Href')}
                  title="Second button link"
                  description='Starts with "/" (storefront page) or "https:"'
                  value={formik.values.cta2Href}
                />
              </>
            )}
          </Spacings.Stack>
        );
      }}
    />
  );
};
BlockDetails.displayName = 'BlockDetails';

export default BlockDetails;
