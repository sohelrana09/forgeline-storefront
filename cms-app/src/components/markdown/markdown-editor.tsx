import { useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FieldErrors from '@commercetools-uikit/field-errors';
import FieldLabel from '@commercetools-uikit/field-label';
import FlatButton from '@commercetools-uikit/flat-button';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import MediaPicker from '../media/media-picker';

type TProps = {
  name: string;
  title: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  isReadOnly?: boolean;
  isRequired?: boolean;
  errors?: Record<string, boolean>;
  touched?: boolean;
};

type TEdit = { before: string; selected: string; after: string };

// Wraps the selection (or a placeholder) in Markdown syntax: **bold**, _italic_, [link](url).
const wrap =
  (left: string, right: string, placeholder: string) => (e: TEdit) => ({
    text: `${e.before}${left}${e.selected || placeholder}${right}${e.after}`,
    select: [
      e.before.length + left.length,
      e.before.length + left.length + (e.selected || placeholder).length,
    ] as const,
  });

// Prefixes every selected line (or the current one): "## ", "- ", "1. ".
const prefixLines = (prefix: (i: number) => string) => (e: TEdit) => {
  const lineStart = e.before.lastIndexOf('\n') + 1;
  const head = e.before.slice(0, lineStart);
  const lines = (e.before.slice(lineStart) + e.selected).split('\n');
  const body = lines
    .map((l, i) => prefix(i) + l.replace(/^(#{1,3} |- |\d+\. )/, ''))
    .join('\n');
  return {
    text: head + body + e.after,
    select: [head.length, head.length + body.length] as const,
  };
};

const insertBlock = (block: string) => (e: TEdit) => {
  const gapBefore =
    e.before === '' || e.before.endsWith('\n\n')
      ? ''
      : e.before.endsWith('\n')
      ? '\n'
      : '\n\n';
  const text = `${e.before}${gapBefore}${block}\n\n${e.after.replace(
    /^\n+/,
    ''
  )}`;
  const end = e.before.length + gapBefore.length + block.length;
  return { text, select: [end, end] as const };
};

const TOOLS = [
  { label: 'Bold', key: 'b', edit: wrap('**', '**', 'bold text') },
  { label: 'Italic', key: 'i', edit: wrap('_', '_', 'italic text') },
  { label: 'Heading', edit: prefixLines(() => '## ') },
  { label: 'Bulleted list', edit: prefixLines(() => '- ') },
  { label: 'Numbered list', edit: prefixLines((i) => `${i + 1}. `) },
  { label: 'Link', key: 'k', edit: wrap('[', '](/path)', 'link text') },
  {
    label: 'Table',
    edit: insertBlock('| Column | Column |\n| --- | --- |\n| Value | Value |'),
  },
];

// Markdown editor for blocks and pages: toolbar (with Ctrl/Cmd+B, I, K), image insert from the media library, and
// a live preview rendered with the same Markdown library as the storefront. The stored value stays Markdown, so
// content/*.json and the storefront are unaffected.
const MarkdownEditor = (props: TProps) => {
  const area = useRef<HTMLTextAreaElement>(null);
  const [picking, setPicking] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const id = `markdown-${props.name}`;

  const apply = (
    edit: (e: TEdit) => { text: string; select: readonly [number, number] }
  ) => {
    const el = area.current;
    if (!el || props.isReadOnly) return;
    const { selectionStart: s, selectionEnd: t, value } = el;
    const result = edit({
      before: value.slice(0, s),
      selected: value.slice(s, t),
      after: value.slice(t),
    });
    props.onChange(result.text);
    // Restore focus and a sensible selection once React has rendered the new value.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.select[0], result.select[1]);
    });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
    if (tool) {
      e.preventDefault();
      apply(tool.edit);
    }
  };

  return (
    <Spacings.Stack scale="xs">
      <FieldLabel
        title={props.title}
        description={props.description}
        hasRequiredIndicator={props.isRequired}
        htmlFor={id}
      />
      {!props.isReadOnly && (
        <div
          role="toolbar"
          aria-label="Formatting"
          aria-controls={id}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
        >
          {TOOLS.map((t) => (
            <FlatButton
              key={t.label}
              label={t.label}
              onClick={() => apply(t.edit)}
            />
          ))}
          <FlatButton label="Image" onClick={() => setPicking(true)} />
          <FlatButton
            label={showPreview ? 'Hide preview' : 'Show preview'}
            tone="secondary"
            onClick={() => setShowPreview((v) => !v)}
          />
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showPreview
            ? 'repeat(auto-fit, minmax(320px, 1fr))'
            : '1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <textarea
          ref={area}
          id={id}
          name={props.name}
          value={props.value}
          readOnly={props.isReadOnly}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
          onKeyDown={onKeyDown}
          rows={16}
          spellCheck
          style={{
            width: '100%',
            minHeight: 280,
            padding: 12,
            border: '1px solid #ccc',
            borderRadius: 4,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 13,
            lineHeight: 1.5,
            resize: 'vertical',
            background: props.isReadOnly ? '#f5f6f7' : '#fff',
          }}
        />
        {showPreview && (
          <section
            aria-label="Preview"
            style={{
              minHeight: 280,
              padding: 12,
              border: '1px dashed #ccc',
              borderRadius: 4,
              background: '#fafafa',
              overflowWrap: 'anywhere',
            }}
          >
            <Text.Detail tone="secondary">Preview</Text.Detail>
            {props.value.trim() ? (
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: ({ src, alt }) => (
                      <img
                        src={typeof src === 'string' ? src : undefined}
                        alt={alt ?? ''}
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: 4,
                        }}
                      />
                    ),
                    table: (p) => (
                      <table
                        style={{ borderCollapse: 'collapse', width: '100%' }}
                        {...p}
                      />
                    ),
                    th: (p) => (
                      <th
                        style={{
                          borderBottom: '1px solid #ccc',
                          textAlign: 'left',
                          padding: '4px 8px',
                        }}
                        {...p}
                      />
                    ),
                    td: (p) => (
                      <td
                        style={{
                          borderBottom: '1px solid #eee',
                          padding: '4px 8px',
                        }}
                        {...p}
                      />
                    ),
                  }}
                >
                  {props.value}
                </ReactMarkdown>
              </div>
            ) : (
              <Text.Body tone="secondary">Nothing to preview yet.</Text.Body>
            )}
          </section>
        )}
      </div>
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
          setPicking(false);
          apply(insertBlock(`![${image.label ?? ''}](${image.url})`));
        }}
      />
    </Spacings.Stack>
  );
};
MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
