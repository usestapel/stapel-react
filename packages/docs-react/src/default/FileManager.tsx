/**
 * `<FileManager/>` — the default skin's composed file-manager surface
 * (owner directive: docs ship good default skins — file manager, context
 * menus, revision modals, editors). One themed layout of the skin's panes:
 *
 *   breadcrumbs
 *   ┌────────────┬──────────────────────┐
 *   │ folder tree│ document list        │  (or the trash pane, toggled)
 *   └────────────┴──────────────────────┘
 *
 * Every part resolves through the skin slot registry, so a host swaps any
 * pane without forking (`registerDocsSkinComponent`), and every operation
 * the panes wire exists server-side 1:1 (there is no duplicate endpoint on
 * stapel-docs, so no duplicate menu item anywhere).
 *
 * The version-history modal is composed here (the list pane's "Version
 * history" context item opens it), and an Upload button rides the pair's
 * `DocUploader` headless into the CURRENT folder. Document opening is the
 * host's routing decision: pass `onOpenDocument` (render `DocSurface`
 * wherever the document should appear); without it rows still render, they
 * just do not navigate.
 *
 * Self-themed via `DocsSkinTheme` (tracker #26: a default skin must carry
 * its own theme provider, never inherit whatever the host supplies).
 */
import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Segmented } from "antd";
import { useT } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { DocUploader } from "../headless/DocUploader.js";
import type { DocDocument } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { DocsSkinTheme } from "./theme.js";
import { resolveDocsSkinComponent } from "./slots.js";

export interface FileManagerProps {
  readonly workspaceId: string;
  /** Light or dark; defaults to the host document's declared mode. */
  readonly mode?: ThemeMode;
  /** A document was opened (left click / "Open"). Route to a `DocSurface`. */
  onOpenDocument?(doc: DocDocument): void;
  /** Full-text query (wire the host's search box in). */
  readonly q?: string;
  /** Upload delivery path — see `UploadVariables.via`. Default `"put_url"`;
   * pass `"content"` on the local-storage backend profile. */
  readonly uploadVia?: "put_url" | "content";
}

export function FileManager(props: FileManagerProps): ReactElement {
  const t = useT();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [view, setView] = useState<"files" | "trash">("files");
  const [historyDoc, setHistoryDoc] = useState<DocDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const TreePane = resolveDocsSkinComponent("fileManager.treePane");
  const ListPane = resolveDocsSkinComponent("fileManager.listPane");
  const Crumbs = resolveDocsSkinComponent("fileManager.breadcrumbs");
  const Trash = resolveDocsSkinComponent("fileManager.trashPane");
  const HistoryModal = resolveDocsSkinComponent("revisionsModal");

  return (
    <DocsSkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      style={{ padding: 12 }}
    >
      <Flex vertical gap="middle" data-testid="docs-file-manager">
        <Flex gap="small" align="center" justify="space-between">
          <Segmented<"files" | "trash">
            size="small"
            value={view}
            options={[
              { value: "files", label: t(DOCS_I18N_KEYS.managerFilesView) },
              { value: "trash", label: t(DOCS_I18N_KEYS.managerTrashView) },
            ]}
            onChange={(next) => {
              setView(next);
            }}
          />
          {view === "files" && (
            <DocUploader
              workspaceId={props.workspaceId}
              {...(folderId !== null ? { folderId } : {})}
              {...(props.uploadVia !== undefined ? { via: props.uploadVia } : {})}
            >
              {({ upload, isUploading }) => (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    data-testid="docs-upload-input"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) upload(file);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    size="small"
                    loading={isUploading}
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    data-analytics="none"
                    data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                  >
                    {t(DOCS_I18N_KEYS.managerUpload)}
                  </Button>
                </>
              )}
            </DocUploader>
          )}
        </Flex>

        {view === "files" ? (
          <>
            <Crumbs
              workspaceId={props.workspaceId}
              folderId={folderId}
              onSelectFolder={setFolderId}
            />
            <Flex gap="middle" align="flex-start">
              <div style={{ flex: "0 0 240px" }}>
                <TreePane
                  workspaceId={props.workspaceId}
                  selectedFolderId={folderId}
                  onSelectFolder={setFolderId}
                />
              </div>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <ListPane
                  workspaceId={props.workspaceId}
                  folderId={folderId}
                  {...(props.q !== undefined ? { q: props.q } : {})}
                  {...(props.onOpenDocument
                    ? { onOpenDocument: props.onOpenDocument }
                    : {})}
                  onShowHistory={setHistoryDoc}
                />
              </div>
            </Flex>
          </>
        ) : (
          <Trash workspaceId={props.workspaceId} />
        )}

        {historyDoc !== null && (
          <HistoryModal
            documentId={historyDoc.id}
            open
            onClose={() => {
              setHistoryDoc(null);
            }}
            {...(props.mode !== undefined ? { mode: props.mode } : {})}
          />
        )}
      </Flex>
    </DocsSkinTheme>
  );
}
