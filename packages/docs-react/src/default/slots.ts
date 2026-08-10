/**
 * The default skin's SLOT REGISTRY — the same register/resolve seam the
 * editor registry established, applied to the skin's own composition points,
 * so every default component is swappable without a fork (a default the
 * customer cannot swap is a decision, not a default):
 *
 * ```tsx
 * registerDocsSkinComponent("fileManager.listPane", MyListPane); // at startup
 * // <FileManager> now renders MyListPane wherever the builtin pane went.
 * ```
 *
 * Resolution: explicit registration > builtin. `unregisterDocsSkinComponent`
 * restores the builtin. The map is typed per slot — a replacement must
 * accept the slot's props (that contract is what makes a swap safe).
 *
 * Editor SLOTS are the skin's chrome-styled defaults for the builtin hints;
 * the EDITOR registry (`registerDocEditor`) stays the seam for replacing an
 * editor globally, and `DocSurface` gives an explicit registration priority
 * over these slots — the two registries never shadow each other.
 */
import type { ComponentType } from "react";
import type { DocEditorAdapterProps } from "../editors/registry.js";
import type { FolderTreePaneProps } from "./FolderTreePane.js";
import type { DocumentListPaneProps } from "./DocumentListPane.js";
import type { FileManagerBreadcrumbsProps } from "./FileManagerBreadcrumbs.js";
import type { TrashPaneProps } from "./TrashPane.js";
import type { RevisionsModalProps } from "./RevisionsModal.js";
import type { FileCardProps } from "./FileCard.js";
import { FolderTreePane } from "./FolderTreePane.js";
import { DocumentListPane } from "./DocumentListPane.js";
import { FileManagerBreadcrumbs } from "./FileManagerBreadcrumbs.js";
import { TrashPane } from "./TrashPane.js";
import { RevisionsModal } from "./RevisionsModal.js";
import { FileCard } from "./FileCard.js";
import {
  DefaultCsvEditor,
  DefaultMarkdownEditor,
  DefaultTextEditor,
} from "./editors.js";

/** Slot name → the component contract a replacement must satisfy. */
export interface DocsSkinSlots {
  readonly "fileManager.treePane": ComponentType<FolderTreePaneProps>;
  readonly "fileManager.listPane": ComponentType<DocumentListPaneProps>;
  readonly "fileManager.breadcrumbs": ComponentType<FileManagerBreadcrumbsProps>;
  readonly "fileManager.trashPane": ComponentType<TrashPaneProps>;
  readonly revisionsModal: ComponentType<RevisionsModalProps>;
  readonly fileCard: ComponentType<FileCardProps>;
  readonly "editor.text": ComponentType<DocEditorAdapterProps>;
  readonly "editor.markdown": ComponentType<DocEditorAdapterProps>;
  readonly "editor.csv": ComponentType<DocEditorAdapterProps>;
}

export type DocsSkinSlotName = keyof DocsSkinSlots;

const builtins: DocsSkinSlots = {
  "fileManager.treePane": FolderTreePane,
  "fileManager.listPane": DocumentListPane,
  "fileManager.breadcrumbs": FileManagerBreadcrumbs,
  "fileManager.trashPane": TrashPane,
  revisionsModal: RevisionsModal,
  fileCard: FileCard,
  "editor.text": DefaultTextEditor,
  "editor.markdown": DefaultMarkdownEditor,
  "editor.csv": DefaultCsvEditor,
};

const registered = new Map<DocsSkinSlotName, DocsSkinSlots[DocsSkinSlotName]>();

/**
 * Register (or override) the component for a skin slot. Call at startup,
 * before the first resolve — module-global, like `registerDocEditor`.
 */
export function registerDocsSkinComponent<K extends DocsSkinSlotName>(
  slot: K,
  component: DocsSkinSlots[K]
): void {
  registered.set(slot, component);
}

/** Remove an explicit registration (the builtin resolves again). */
export function unregisterDocsSkinComponent(slot: DocsSkinSlotName): void {
  registered.delete(slot);
}

/** Resolve a slot: explicit registration > builtin. Never `null` — every
 * slot ships a builtin. */
export function resolveDocsSkinComponent<K extends DocsSkinSlotName>(
  slot: K
): DocsSkinSlots[K] {
  return (registered.get(slot) as DocsSkinSlots[K] | undefined) ?? builtins[slot];
}
