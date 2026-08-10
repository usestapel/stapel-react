/**
 * The default skin's shared small dialogs — one name prompt (rename / new
 * folder) and one destination picker (move). Controlled components: the
 * owning pane opens them from a context-menu action and runs the mutation in
 * `onConfirm`; the dialogs render form state only. Both live inside the
 * pane's own `<DocsSkinTheme>` (antd `Modal` inherits the ConfigProvider
 * theme through context, portal or not).
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Input, Modal, Select } from "antd";
import { useT } from "@stapel/core";
import type { DocFolder } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";

export interface NameDialogProps {
  readonly open: boolean;
  /** i18n key for the modal title (rename vs new-folder). */
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
  return (
    <Modal
      open={props.open}
      title={t(props.titleKey)}
      okText={t(DOCS_I18N_KEYS.dialogOk)}
      cancelText={t(DOCS_I18N_KEYS.dialogCancel)}
      okButtonProps={{ disabled: trimmed.length === 0, loading: props.busy ?? false }}
      onOk={() => {
        if (trimmed.length > 0) props.onConfirm(trimmed);
      }}
      onCancel={() => {
        props.onClose();
      }}
      destroyOnHidden
    >
      <Input
        data-testid="docs-name-input"
        placeholder={t(DOCS_I18N_KEYS.dialogNamePlaceholder)}
        value={value}
        autoFocus
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onPressEnter={() => {
          if (trimmed.length > 0) props.onConfirm(trimmed);
        }}
      />
    </Modal>
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

  return (
    <Modal
      open={props.open}
      title={t(DOCS_I18N_KEYS.dialogMoveTitle)}
      okText={t(DOCS_I18N_KEYS.dialogOk)}
      cancelText={t(DOCS_I18N_KEYS.dialogCancel)}
      okButtonProps={{ loading: props.busy ?? false }}
      onOk={() => {
        props.onConfirm(value === ROOT_OPTION ? null : value);
      }}
      onCancel={() => {
        props.onClose();
      }}
      destroyOnHidden
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
    </Modal>
  );
}
