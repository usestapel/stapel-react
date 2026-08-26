/**
 * The default skin's shared small dialogs — a name prompt (rename / new
 * folder), a destination picker (move), and the "New document" prompt
 * (name + type). Controlled components: the owning pane opens them from an
 * action and runs the mutation in `onConfirm`; the dialogs render form state
 * only.
 *
 * Every one renders through `@stapel/tokens-antd/skin`'s `<SkinDialog>` — a
 * bottom sheet on a phone, a centred modal on tablet/desktop (owner ruling
 * 2026-08-24). `SkinDialog` owns no action row, so the confirm/cancel pair is
 * rendered here.
 *
 * ── Each one wraps ITSELF in `SkinTheme` ──────────────────────────────────
 *
 * A dialog renders into a portal at the end of `<body>`, so it inherits a
 * theme only from the React tree it is DECLARED in — and these are declared
 * beside the control that opens them, which in the showcase (and in any host
 * that mounts a pane on its own) is not inside anybody's `ConfigProvider`.
 * The header comment here used to claim the pane's `SkinTheme` covered them;
 * the visual pass photographed the result — a WHITE sheet over a black page
 * in every dark shot (CF-1 / N-1). Nested `SkinTheme`s cost nothing (the
 * substrate reuses an identical applied theme and renders no second
 * provider), so self-theming is free and inheriting is a bug waiting.
 *
 * ── The confirm names its action ──────────────────────────────────────────
 *
 * "OK" is what a button says when nobody decided what it does. Each dialog
 * takes the verb from its caller (`confirmKey`) — Rename, Create folder,
 * Move, Create — and the blocked REASON stacks under the button instead of
 * trailing off the right edge of a 390px sheet.
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
import { GatedButton, SkinDialog, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { actionAvailable, actionBlocked, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { DocFolder } from "../api/types.js";
import type { DocumentTypeOption } from "../model/documentTypes.js";
import { DEFAULT_DOCUMENT_TYPES } from "../model/documentTypes.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";

/** Props every one of these dialogs shares. */
interface DialogChromeProps {
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

/**
 * Cancel and the affirmative, with the affirmative's blocked reason UNDER it.
 *
 * `layout="inline"` put the sentence beside the button, which on a phone sheet
 * meant it ran past the right edge; stacked, it sits under the control it
 * explains and the row still reads Cancel-then-confirm.
 */
function DialogFooter(props: {
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly gate: ActionAvailability;
  readonly busy: boolean;
  readonly testId: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): ReactElement {
  return (
    <Flex justify="end" align="flex-start" gap="small" wrap>
      <Button
        onClick={props.onCancel}
        data-analytics="none"
        data-analytics-reason="local UI dismissal — closing a form is not a business action"
      >
        {props.cancelLabel}
      </Button>
      <GatedButton
        gate={props.gate}
        type="primary"
        loading={props.busy}
        onClick={props.onConfirm}
        testId={props.testId}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      >
        {props.confirmLabel}
      </GatedButton>
    </Flex>
  );
}

export interface NameDialogProps extends DialogChromeProps {
  readonly open: boolean;
  /** i18n key for the dialog title (rename vs new-folder). */
  readonly titleKey: string;
  /** i18n key for the affirmative's verb. Default: the generic "OK", which
   * every caller in this package overrides. */
  readonly confirmKey?: string;
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
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
    <SkinDialog
      open={props.open}
      title={t(props.titleKey)}
      dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
      onClose={() => {
        props.onClose();
      }}
      footer={
        <DialogFooter
          cancelLabel={t(DOCS_I18N_KEYS.dialogCancel)}
          confirmLabel={t(props.confirmKey ?? DOCS_I18N_KEYS.dialogOk)}
          gate={gate}
          busy={props.busy ?? false}
          testId="docs-name-confirm"
          onCancel={props.onClose}
          onConfirm={confirm}
        />
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
    </SkinTheme>
  );
}

export interface MoveDialogProps extends DialogChromeProps {
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
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
    <SkinDialog
      open={props.open}
      title={t(DOCS_I18N_KEYS.dialogMoveTitle)}
      dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
      onClose={() => {
        props.onClose();
      }}
      footer={
        <DialogFooter
          cancelLabel={t(DOCS_I18N_KEYS.dialogCancel)}
          confirmLabel={t(DOCS_I18N_KEYS.dialogMoveConfirm)}
          gate={gate}
          busy={props.busy ?? false}
          testId="docs-move-confirm"
          onCancel={props.onClose}
          onConfirm={() => {
            props.onConfirm(destination);
          }}
        />
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
    </SkinTheme>
  );
}

export interface NewDocumentDialogProps extends DialogChromeProps {
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
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
    <SkinDialog
      open={props.open}
      title={t(DOCS_I18N_KEYS.dialogNewDocumentTitle)}
      dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
      onClose={() => {
        props.onClose();
      }}
      footer={
        <DialogFooter
          cancelLabel={t(DOCS_I18N_KEYS.dialogCancel)}
          confirmLabel={t(DOCS_I18N_KEYS.dialogCreateDocumentConfirm)}
          gate={gate}
          busy={props.busy ?? false}
          testId="docs-new-document-confirm"
          onCancel={props.onClose}
          onConfirm={confirm}
        />
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
    </SkinTheme>
  );
}
