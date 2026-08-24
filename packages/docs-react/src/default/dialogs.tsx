/**
 * The default skin's shared small dialogs — one name prompt (rename / new
 * folder) and one destination picker (move). Controlled components: the
 * owning pane opens them from a context-menu action and runs the mutation in
 * `onConfirm`; the dialogs render form state only. Both live inside the
 * pane's own `<DocsSkinTheme>` (the dialog surface inherits the
 * ConfigProvider theme through context, portal or not).
 *
 * Both render through `@stapel/tokens-antd/skin`'s `<SkinDialog>` — a bottom
 * sheet on a phone, a centred modal on tablet/desktop (owner ruling
 * 2026-08-24). `SkinDialog` owns no action row, so the OK/Cancel pair antd's
 * `Modal` used to synthesize from `onOk`/`okButtonProps` is rendered here,
 * with the same disabled/busy semantics.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Input, Select } from "antd";
import { SkinDialog } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import type { DocFolder } from "../api/types.js";
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
        <Flex justify="end" gap="small">
          <Button
            onClick={() => {
              props.onClose();
            }}
            data-analytics="none"
            data-analytics-reason="local UI dismissal — closing a form is not a business action"
          >
            {t(DOCS_I18N_KEYS.dialogCancel)}
          </Button>
          <Button
            type="primary"
            disabled={trimmed.length === 0}
            loading={props.busy ?? false}
            onClick={confirm}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          >
            {t(DOCS_I18N_KEYS.dialogOk)}
          </Button>
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
  // selection is a real move, the same way `NameDialog` is off on an empty
  // name.
  const unchanged = destination === props.currentParentId;

  return (
    <SkinDialog
      open={props.open}
      title={t(DOCS_I18N_KEYS.dialogMoveTitle)}
      dismissLabel={t(DOCS_I18N_KEYS.dialogClose)}
      onClose={() => {
        props.onClose();
      }}
      footer={
        <Flex justify="end" gap="small">
          <Button
            onClick={() => {
              props.onClose();
            }}
            data-analytics="none"
            data-analytics-reason="local UI dismissal — closing a form is not a business action"
          >
            {t(DOCS_I18N_KEYS.dialogCancel)}
          </Button>
          <Button
            type="primary"
            disabled={unchanged}
            loading={props.busy ?? false}
            onClick={() => {
              props.onConfirm(destination);
            }}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          >
            {t(DOCS_I18N_KEYS.dialogOk)}
          </Button>
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
