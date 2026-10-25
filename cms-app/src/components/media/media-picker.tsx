import { useRef, useState, type DragEvent } from 'react';
import { InfoDialog } from '@commercetools-frontend/application-components';
import { useShowNotification } from '@commercetools-frontend/actions-global';
import {
  DOMAINS,
  NOTIFICATION_KINDS_SIDE,
} from '@commercetools-frontend/constants';
import FlatButton from '@commercetools-uikit/flat-button';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import { ContentNotification } from '@commercetools-uikit/notifications';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { getErrorMessage } from '../../helpers';
import {
  useMediaDelete,
  useMediaLibrary,
  useMediaUpload,
  type TMediaImage,
} from '../../hooks/use-media-library';

const fileName = (url: string) =>
  decodeURIComponent(url.split('/').pop() ?? url);

type TProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (image: TMediaImage) => void;
  canUpload: boolean;
};

// The media library: every uploaded image, newest first. Upload with the button or by dropping files on the
// dialog; choosing an image (or finishing an upload) hands it to the field that opened the dialog. Delete asks
// first and refuses while a block or page still uses the image (the storefront would show a broken picture).
const MediaPicker = ({ isOpen, onClose, onSelect, canUpload }: TProps) => {
  const { images, productId, error, loading, refetch } = useMediaLibrary();
  const { upload, uploading } = useMediaUpload(productId);
  const showNotification = useShowNotification();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { usedBy, deleteImage, deleting } = useMediaDelete();
  // The image being deleted: undefined while its usage is being checked.
  const [pending, setPending] = useState<{ url: string; usedBy?: string[] }>();

  const notify = (kind: 'success' | 'error', text: string) =>
    showNotification({
      kind: NOTIFICATION_KINDS_SIDE[kind],
      domain: DOMAINS.SIDE,
      text,
    });
  const askDelete = async (url: string) => {
    setPending({ url });
    try {
      setPending({ url, usedBy: await usedBy(url) });
    } catch (err) {
      setPending(undefined);
      notify('error', (err as Error).message);
    }
  };
  const confirmDelete = async () => {
    if (!pending) return;
    try {
      await deleteImage(pending.url);
      await refetch();
      notify('success', `Deleted ${fileName(pending.url)}`);
    } catch (err) {
      notify('error', (err as Error).message);
    }
    setPending(undefined);
  };

  const uploadFile = async (file?: File) => {
    if (!file) return;
    try {
      const image = await upload(file);
      await refetch();
      showNotification({
        kind: NOTIFICATION_KINDS_SIDE.success,
        domain: DOMAINS.SIDE,
        text: `Uploaded ${fileName(image.url)}`,
      });
      onSelect(image);
    } catch (err) {
      showNotification({
        kind: NOTIFICATION_KINDS_SIDE.error,
        domain: DOMAINS.SIDE,
        text: (err as Error).message,
      });
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (canUpload) void uploadFile(e.dataTransfer.files[0]);
  };

  return (
    <InfoDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Media library"
      size={16}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (canUpload) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          outline: dragging ? '2px dashed #00b39e' : 'none',
          outlineOffset: 4,
          borderRadius: 4,
        }}
      >
        <Spacings.Stack scale="m">
          {canUpload && (
            <Spacings.Inline alignItems="center" scale="m">
              <PrimaryButton
                label={uploading ? 'Uploading…' : 'Upload image'}
                onClick={() => input.current?.click()}
                isDisabled={uploading || !productId}
              />
              <Text.Detail tone="secondary">
                Or drop a file here. JPEG, PNG and GIF upload as they are; WebP
                and very large pictures are converted to JPEG, at most 2400 px
                wide.
              </Text.Detail>
              <input
                ref={input}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void uploadFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </Spacings.Inline>
          )}
          {error && (
            <ContentNotification type="error">
              {getErrorMessage(error)}
            </ContentNotification>
          )}
          {!loading && !error && !productId && (
            <ContentNotification type="warning">
              The media library isn&apos;t set up yet. Run &quot;npm run
              ct:media-library&quot; in the storefront project once.
            </ContentNotification>
          )}
          {pending &&
            (pending.usedBy === undefined ? (
              <ContentNotification type="info">
                Checking where {fileName(pending.url)} is used…
              </ContentNotification>
            ) : pending.usedBy.length > 0 ? (
              <ContentNotification type="warning">
                <Spacings.Stack scale="s">
                  <span>
                    {fileName(pending.url)} is still used in{' '}
                    {pending.usedBy.join(', ')}. Replace or remove it there
                    first, then delete it here.
                  </span>
                  <div>
                    <SecondaryButton
                      label="OK"
                      onClick={() => setPending(undefined)}
                    />
                  </div>
                </Spacings.Stack>
              </ContentNotification>
            ) : (
              <ContentNotification type="warning">
                <Spacings.Stack scale="s">
                  <span>
                    Delete {fileName(pending.url)} from the media library? No
                    block or page uses it. This can&apos;t be undone.
                  </span>
                  <Spacings.Inline scale="m">
                    <PrimaryButton
                      tone="critical"
                      label={deleting ? 'Deleting…' : 'Delete image'}
                      onClick={() => void confirmDelete()}
                      isDisabled={deleting}
                    />
                    <SecondaryButton
                      label="Cancel"
                      onClick={() => setPending(undefined)}
                      isDisabled={deleting}
                    />
                  </Spacings.Inline>
                </Spacings.Stack>
              </ContentNotification>
            ))}
          {loading && images.length === 0 ? (
            <LoadingSpinner />
          ) : images.length === 0 ? (
            <Text.Body tone="secondary">No images yet.</Text.Body>
          ) : (
            <ul
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 12,
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {images.map((img) => (
                <li key={img.url}>
                  <button
                    type="button"
                    onClick={() => onSelect(img)}
                    title={`Use ${fileName(img.url)}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      width: '100%',
                      padding: 6,
                      border: '1px solid #ccc',
                      borderRadius: 4,
                      background: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <img
                      src={img.url}
                      alt=""
                      loading="lazy"
                      style={{
                        width: '100%',
                        aspectRatio: '16 / 10',
                        objectFit: 'cover',
                        borderRadius: 2,
                      }}
                    />
                    <Text.Detail truncate>{fileName(img.url)}</Text.Detail>
                    <Text.Detail tone="secondary">
                      {img.dimensions.width} × {img.dimensions.height}
                    </Text.Detail>
                  </button>
                  {canUpload && (
                    <FlatButton
                      label="Delete"
                      tone="secondary"
                      onClick={() => void askDelete(img.url)}
                      isDisabled={Boolean(pending)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Spacings.Stack>
      </div>
    </InfoDialog>
  );
};
MediaPicker.displayName = 'MediaPicker';

export default MediaPicker;
