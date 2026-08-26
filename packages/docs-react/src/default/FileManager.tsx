/**
 * `<FileManager/>` — the default skin's composed file-manager surface
 * (owner directive: docs ship good default skins — file manager, context
 * menus, revision modals, editors). One themed layout of the skin's panes:
 *
 *   toolbar (New document · Upload · Files/Trash)
 *   breadcrumbs
 *   ┌────────────┬──────────────────────┐
 *   │ folder tree│ document list        │  (or the trash pane, toggled)
 *   └────────────┴──────────────────────┘
 *
 * On a NARROW container the two panes become one at a time, with a switch
 * between them, and picking a folder moves to the documents in it — the
 * phone shape of a file manager. The decision reads the container's own
 * width, not the viewport (`useSplitLayout`), so this surface mounted in a
 * 380px side panel on a desktop lays out like a phone, which is the whole
 * point of the rule.
 *
 * Every part resolves through the skin slot registry, so a host swaps any
 * pane without forking (`registerDocsSkinComponent`), and every operation
 * the panes wire exists server-side 1:1 (there is no duplicate endpoint on
 * stapel-docs, so no duplicate menu item anywhere).
 *
 * The two creation doors are both here, because both are how a document
 * comes into existence: `New document` (`POST /documents`, the primary
 * action of a documents product) and `Upload` (`POST /uploads` → bytes →
 * finalize, riding the pair's `DocUploader` headless). Both land in the
 * CURRENT folder. Document OPENING is the host's routing decision: pass
 * `onOpenDocument` (render `DocSurface` wherever the document should
 * appear); without it the rows do not offer an "Open" that goes nowhere.
 *
 * Self-themed via `SkinTheme` (tracker #26: a default skin must carry its own
 * theme provider, never inherit whatever the host supplies).
 */
import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Segmented } from "antd";
import { SkinTheme, ErrorAlert } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { spacing } from "@stapel/tokens";
import { DocUploader } from "../headless/DocUploader.js";
import type { DocDocument } from "../api/types.js";
import { useCreateDocument } from "../model/mutations.js";
import type { DocumentTypeOption } from "../model/documentTypes.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { resolveDocsSkinComponent } from "./slots.js";
import { NewDocumentDialog } from "./dialogs.js";
import { useSplitLayout } from "./useSplitLayout.js";

/**
 * How wide the folder tree sits beside the document list once there is room
 * for both. A genuine one-off geometry (a sidebar is not on the spacing
 * scale), so it is a named export rather than a literal in a style object:
 * a host that wants a wider tree changes it in one place.
 */
export const FOLDER_PANE_WIDTH: number = 240;

export interface FileManagerProps {
  readonly workspaceId: string;
  /** Light or dark; defaults to the host document's live declared mode. */
  readonly mode?: ThemeMode;
  /** A document was opened (row click / "Open"). Route to a `DocSurface`.
   * Omitted → the rows carry no opening affordance at all. */
  onOpenDocument?(doc: DocDocument): void;
  /** Full-text query (wire the host's search box in). */
  readonly q?: string;
  /** Upload delivery path — see `UploadVariables.via`. Default `"put_url"`;
   * pass `"content"` on the local-storage backend profile. */
  readonly uploadVia?: "put_url" | "content";
  /** Types the "New document" dialog offers. Default: the three editable
   * builtins (`model/documentTypes.ts`). */
  readonly documentTypes?: readonly DocumentTypeOption[];
}

/** Which pane a stacked (narrow) layout is showing. */
type StackedPane = "folders" | "files";

export function FileManager(props: FileManagerProps): ReactElement {
  const t = useT();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [view, setView] = useState<"files" | "trash">("files");
  const [pane, setPane] = useState<StackedPane>("files");
  const [historyDoc, setHistoryDoc] = useState<DocDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createDocument = useCreateDocument();
  const { containerRef, stacked } = useSplitLayout();

  const TreePane = resolveDocsSkinComponent("fileManager.treePane");
  const ListPane = resolveDocsSkinComponent("fileManager.listPane");
  const Crumbs = resolveDocsSkinComponent("fileManager.breadcrumbs");
  const Trash = resolveDocsSkinComponent("fileManager.trashPane");
  const HistoryModal = resolveDocsSkinComponent("revisionsModal");

  function selectFolder(next: string | null): void {
    setFolderId(next);
    // On one pane at a time, picking a folder IS asking to see what is in it.
    setPane("files");
  }

  const themeProps = props.mode !== undefined ? { mode: props.mode } : {};
  const treePane = (
    <TreePane
      workspaceId={props.workspaceId}
      selectedFolderId={folderId}
      onSelectFolder={selectFolder}
      {...themeProps}
    />
  );
  const listPane = (
    <ListPane
      workspaceId={props.workspaceId}
      folderId={folderId}
      {...(props.q !== undefined ? { q: props.q } : {})}
      {...(props.onOpenDocument ? { onOpenDocument: props.onOpenDocument } : {})}
      onShowHistory={setHistoryDoc}
      {...themeProps}
    />
  );

  return (
    // `base`, not the default `raised`: this is a full screen whose children
    // are the raised things. As a raised panel it painted a slightly lighter
    // box that stopped at content height with a hard edge over the page's own
    // background, and the segmented controls inside it — designed against a
    // layout background — read as holes punched in the panel (visual pass
    // N-1).
    <SkinTheme
      {...themeProps}
      surface="base"
      style={{ padding: spacing[3], minHeight: "100%" }}
    >
      <Flex vertical gap="middle" data-testid="docs-file-manager">
        <Flex gap="small" align="center" justify="space-between" wrap>
          <Segmented<"files" | "trash">
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
            <Flex gap="small" align="center" wrap>
              <Button
                type="primary"
                onClick={() => {
                  setCreating(true);
                }}
                data-testid="docs-new-document"
                data-analytics="none"
                data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
              >
                {t(DOCS_I18N_KEYS.managerNewDocument)}
              </Button>
              <DocUploader
                workspaceId={props.workspaceId}
                {...(folderId !== null ? { folderId } : {})}
                {...(props.uploadVia !== undefined ? { via: props.uploadVia } : {})}
              >
                {({ upload, isUploading, error }) => (
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
                      loading={isUploading}
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      data-analytics="none"
                      data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                    >
                      {t(DOCS_I18N_KEYS.managerUpload)}
                    </Button>
                    <ErrorAlert
                      variant="inline"
                      thrown={error}
                      testId="docs-upload-error"
                    />
                  </>
                )}
              </DocUploader>
            </Flex>
          )}
        </Flex>

        <ErrorAlert
          thrown={createDocument.error}
          testId="docs-create-document-error"
        />

        {view === "files" ? (
          <>
            <Crumbs
              workspaceId={props.workspaceId}
              folderId={folderId}
              onSelectFolder={selectFolder}
              {...themeProps}
            />
            {stacked && (
              <Segmented<StackedPane>
                block
                value={pane}
                options={[
                  {
                    value: "folders",
                    label: t(DOCS_I18N_KEYS.managerFoldersPane),
                  },
                  { value: "files", label: t(DOCS_I18N_KEYS.managerFilesPane) },
                ]}
                onChange={(next) => {
                  setPane(next);
                }}
                data-testid="docs-pane-switch"
              />
            )}
            <div ref={containerRef}>
              {stacked ? (
                <div data-testid="docs-stacked-pane">
                  {pane === "folders" ? treePane : listPane}
                </div>
              ) : (
                <Flex gap="middle" align="flex-start">
                  <div style={{ flex: `0 0 ${String(FOLDER_PANE_WIDTH)}px` }}>
                    {treePane}
                  </div>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>{listPane}</div>
                </Flex>
              )}
            </div>
          </>
        ) : (
          <Trash workspaceId={props.workspaceId} {...themeProps} />
        )}

        <NewDocumentDialog
          open={creating}
          {...themeProps}
          {...(props.documentTypes !== undefined
            ? { documentTypes: props.documentTypes }
            : {})}
          busy={createDocument.isPending}
          onConfirm={({ title, type }) => {
            createDocument.mutate(
              {
                workspace_id: props.workspaceId,
                type,
                title,
                folder_id: folderId,
              },
              {
                onSuccess: (created) => {
                  setCreating(false);
                  // A document is created in order to be written in: hand it
                  // straight to the host's route when there is one.
                  props.onOpenDocument?.(created);
                },
              }
            );
          }}
          onClose={() => {
            setCreating(false);
          }}
        />

        {historyDoc !== null && (
          <HistoryModal
            documentId={historyDoc.id}
            open
            onClose={() => {
              setHistoryDoc(null);
            }}
            {...themeProps}
          />
        )}
      </Flex>
    </SkinTheme>
  );
}
