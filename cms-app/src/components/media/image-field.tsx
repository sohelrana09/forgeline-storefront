import { useState } from 'react';
import FieldErrors from '@commercetools-uikit/field-errors';
import FieldLabel from '@commercetools-uikit/field-label';
import FlatButton from '@commercetools-uikit/flat-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import Spacings from '@commercetools-uikit/spacings';
import TextInput from '@commercetools-uikit/text-input';
import MediaPicker from './media-picker';

type TProps = {
  name: string;
  title: string;
  description?: string;
  value: string;
  onChange: (url: string) => void;
  isReadOnly?: boolean;
  isRequired?: boolean;
  errors?: Record<string, boolean>;
  touched?: boolean;
};

// One picture: preview, the URL (pasting one from the media library hosts also works), and a button that opens
// the media library to choose or upload.
const ImageField = (props: TProps) => {
  const [picking, setPicking] = useState(false);
  const id = `image-field-${props.name}`;
  return (
    <Spacings.Stack scale="xs">
      <FieldLabel
        title={props.title}
        description={props.description}
        hasRequiredIndicator={props.isRequired}
        htmlFor={id}
      />
      {props.value && (
        <img
          src={props.value}
          alt=""
          style={{
            maxWidth: 420,
            width: '100%',
            aspectRatio: '16 / 9',
            objectFit: 'cover',
            borderRadius: 4,
            border: '1px solid #ccc',
          }}
        />
      )}
      <TextInput
        id={id}
        name={props.name}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value.trim())}
        isReadOnly={props.isReadOnly}
        placeholder="https://images.us-east-2.aws.commercetools.com/…"
        horizontalConstraint={16}
      />
      {!props.isReadOnly && (
        <Spacings.Inline scale="m" alignItems="center">
          <SecondaryButton
            label="Choose or upload…"
            onClick={() => setPicking(true)}
          />
          {props.value && (
            <FlatButton
              label="Remove"
              tone="secondary"
              onClick={() => props.onChange('')}
            />
          )}
        </Spacings.Inline>
      )}
      <FieldErrors
        errors={props.errors}
        isVisible={Boolean(props.touched)}
        renderError={(key) => key}
      />
      <MediaPicker
        isOpen={picking}
        canUpload={!props.isReadOnly}
        onClose={() => setPicking(false)}
        onSelect={(image) => {
          props.onChange(image.url);
          setPicking(false);
        }}
      />
    </Spacings.Stack>
  );
};
ImageField.displayName = 'ImageField';

export default ImageField;
