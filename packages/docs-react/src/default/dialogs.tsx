/**
 * The default skin's shared small dialogs — a name prompt (rename / new
 * folder), a destination picker (move), and the "New document" prompt
 * (name + type). Controlled components: the owning pane opens them from an
 * action and runs the mutation in `onConfirm`; the dialogs render form state
 * only. All three live inside the pane's own `<SkinTheme>` (the dialog
 * surface inherits the `ConfigProvider` theme through context, portal or not).
 *
 * Every one renders through `@stapel/tokens-antd/skin`'s `<SkinDialog>` — a
 * bottom sheet on a phone, a centred modal on tablet/desktop (owner ruling
 * 2026-08-24). `SkinDialog` owns no action row, so the OK/Cancel pair is
 * rendered here.
 *
 * The OK button is a `<GatedButton>`, not a `disabled={...}` boolean: a grey
 * button with no sentence beside it is one bit short of what the person needs
 * ("is my name too short? am I not allowed?"). The two rules that switch it
 * off — an empty name, a destination that is where the item already is — each
 * say so in words, wired to the button by `aria-describedby`.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Input, Select } from "antd";
import { GatedButton, SkinDialog } from "@stapel/tokens-antd/skin";
import { actionAvailable, actionBlocked, useT } from "@stapel/core";
import type { DocFolder } from "../api/types.js";
import type { DocumentTypeOption } from "../model/documentTypes.js";
import { DEFAULT_DOCUMENT_TYPES } from "../model/documentTypes.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";

export interface NameDialogProps {
  readonly open: boolean;
  /** i18n key for the dialog title (rename vs new-folder). */
  readonly titleKey: string;
  /** Prefilled value (the current name when renaming; empty when creating). */
  readonly initialValue: string;
  readonly busy?: boolean;
  onConfirm(name: string): void;
  onClose(): void;
}

/** Rename / new-folder prompt: one required text field. */
export function NameDialog(props: NameDialogProps): ReactElement {
  const t = useT();
  const [value, setValue] = useState(props.initialValue);
  // Re-arm the field each time the dialog opens for a (possibly different)
  // subject; while open, the user's typing owns the state.
  const { open, initialValue } = props;
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const trimmed = value.trim();
  const gate =
    trimmed.length === 0
      ? actionBlocked(DOCS_I18N_KEYS.dialogNameBlockedEmpty)
      : actionAvailable();
  const confirm = (): void => {
    if (trimmed.length > 0) props.onConfirm(trimmed);
  };
  return (
    <SkinDialog
      open={props.open}
      title={t(props.titleKey)}
      dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
      onClose={() => {
        props.onClose();
      }}
      footer={
        <Flex justify="end" align="center" gap="small" wrap>
          <Button
            onClick={() => {
              props.onClose();
            }}
            data-analytics="none"
            data-analytics-reason="local UI dismissal — closing a form is not a business action"
          >
            {t(DOCS_I18N_KEYS.dialogCancel)}
          </Button>
          <GatedButton
            gate={gate}
            layout="inline"
            type="primary"
            loading={props.busy ?? false}
            onClick={confirm}
            testId="docs-name-confirm"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          >
            {t(DOCS_I18N_KEYS.dialogOk)}
          </GatedButton>
        </Flex>
      }
    >
      <Input
        data-testid="docs-name-input"
        placeholder={t(DOCS_I18N_KEYS.dialogNamePlaceholder)}
        value={value}
        autoFocus
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onPressEnter={confirm}
      />
    </SkinDialog>
  );
}

export interface MoveDialogProps {
  readonly open: boolean;
  /** The workspace's folders, flat (the same list the tree reads). */
  readonly folders: readonly DocFolder[];
  /** Folder ids that must not be offered as a destination (the moved folder
   * itself and its descendants — the backend refuses a cycle anyway; the
   * picker just does not offer one). Empty when moving a document. */
  readonly excludedIds?: ReadonlySet<string>;
  /** The subject's current parent, preselected. `null` = workspace root. */
  readonly currentParentId: string | null;
  readonly busy?: boolean;
  onConfirm(destinationId: string | null): void;
  onClose(): void;
}

/** Sentinel option value for the workspace root (`Select` cannot carry
 * `null` as a value). Never collides: folder ids are UUIDs. */
const ROOT_OPTION = "__root__";

/** Move-destination picker: the folder list plus the workspace root. */
export function MoveDialog(props: MoveDialogProps): ReactElement {
  const t = useT();
  const [value, setValue] = useState<string>(
    props.currentParentId ?? ROOT_OPTION
  );
  const { open, currentParentId } = props;
  useEffect(() => {
    if (open) setValue(currentParentId ?? ROOT_OPTION);
  }, [open, currentParentId]);

  const options = [
    { value: ROOT_OPTION, label: t(DOCS_I18N_KEYS.dialogRootFolder) },
    ...props.folders
      .filter((folder) => !(props.excludedIds?.has(folder.id) ?? false))
      .map((folder) => ({ value: folder.id, label: folder.name })),
  ];

  const destination = value === ROOT_OPTION ? null : value;
  // The dialog opens preselected on the subject's current parent, so its
  // confirm starts on "move this document to the folder it is already in" —
  // a PATCH the backend accepts and that changes nothing. Off until the
  // selection is a real move, WITH the sentence saying why.
  const gate =
    destination === props.currentParentId
      ? actionBlocked(DOCS_I18N_KEYS.dialogMoveBlockedUnchanged)
      : actionAvailable();

  return (
    <SkinDialog
      open={props.open}
      title={t(DOCS_I18N_KEYS.dialogMoveTitle)}
      dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
      onClose={() => {
        props.onClose();
      }}
      footer={
        <Flex justify="end" align="center" gap="small" wrap>
          <Button
            onClick={() => {
              props.onClose();
            }}
            data-analytics="none"
            data-analytics-reason="local UI dismissal — closing a form is not a business action"
          >
            {t(DOCS_I18N_KEYS.dialogCancel)}
          </Button>
          <GatedButton
            gate={gate}
            layout="inline"
            type="primary"
            loading={props.busy ?? false}
            onClick={() => {
              props.onConfirm(destination);
            }}
            testId="docs-move-confirm"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          >
            {t(DOCS_I18N_KEYS.dialogOk)}
          </GatedButton>
        </Flex>
      }
    >
      <Select
        data-testid="docs-move-select"
        style={{ width: "100%" }}
        aria-label={t(DOCS_I18N_KEYS.dialogMoveTarget)}
        value={value}
        options={options}
        onChange={(next: string) => {
          setValue(next);
        }}
      />
    </SkinDialog>
  );
}

export interface NewDocumentDialogProps {
  readonly open: boolean;
  /** Creatable types, in the order they are offered. Default: the three
   * editable builtins (see `model/documentTypes.ts`). */
  readonly documentTypes?: readonly DocumentTypeOption[];
  readonly busy?: boolean;
  onConfirm(input: { readonly title: string; readonly type: string }): void;
  onClose(): void;
}

/**
 * "New document": a title and a type. The type picker is a real question —
 * `POST /documents` needs the registry slug, and the slug decides which
 * editor the document opens in — so it is asked here rather than guessed,
 * with the first offered type preselected so the common case is one field.
 */
export function NewDocumentDialog(props: NewDocumentDialogProps): ReactElement {
  const t = useT();
  const types = props.documentTypes ?? DEFAULT_DOCUMENT_TYPES;
  const firstType = types[0]?.type ?? "";
  const [title, setTitle] = useState("");
  const [type, setType] = useState(firstType);
  const { open } = props;
  useEffect(() => {
    if (open) {
      setTitle("");
      setType(firstType);
    }
  }, [open, firstType]);

  const trimmed = title.trim();
  const gate =
    trimmed.length === 0
      ? actionBlocked(DOCS_I18N_KEYS.dialogNameBlockedEmpty)
      : actionAvailable();
  const confirm = (): void => {
    if (trimmed.length > 0) props.onConfirm({ title: trimmed, type });
  };

  return (
    <SkinDialog
      open={props.open}
      title={t(DOCS_I18N_KEYS.dialogNewDocumentTitle)}
      dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
      onClose={() => {
        props.onClose();
      }}
      footer={
        <Flex justify="end" align="center" gap="small" wrap>
          <Button
            onClick={() => {
              props.onClose();
            }}
            data-analytics="none"
            data-analytics-reason="local UI dismissal — closing a form is not a business action"
          >
            {t(DOCS_I18N_KEYS.dialogCancel)}
          </Button>
          <GatedButton
            gate={gate}
            layout="inline"
            type="primary"
            loading={props.busy ?? false}
            onClick={confirm}
            testId="docs-new-document-confirm"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          >
            {t(DOCS_I18N_KEYS.dialogOk)}
          </GatedButton>
        </Flex>
      }
    >
      <Flex vertical gap="small">
        <Input
          data-testid="docs-new-document-title"
          placeholder={t(DOCS_I18N_KEYS.dialogNamePlaceholder)}
          value={title}
          autoFocus
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          onPressEnter={confirm}
        />
        <Select
          data-testid="docs-new-document-type"
          style={{ width: "100%" }}
          aria-label={t(DOCS_I18N_KEYS.dialogDocumentType)}
          value={type}
          options={types.map((option) => ({
            value: option.type,
            label: t(option.labelKey),
          }))}
          onChange={(next: string) => {
            setType(next);
          }}
        />
      </Flex>
    </SkinDialog>
  );
}
