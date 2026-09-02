/**
 * `<DriveScreen/>` — the product.
 *
 * ── One column, and no second layout ──────────────────────────────────────
 *
 * Phone-first is not a breakpoint here, it is the shape: a sticky path strip,
 * one scrolling column of rows (or tiles), a bottom sheet for row actions, a
 * FAB for upload. On a wide window the column simply stops growing at
 * `DRIVE_MEASURE` and centres. That IS the desktop story (spec §4:
 * "acceptable degradation via max-width container — do not build a second
 * layout"), because the two-pane desktop file manager already exists and is
 * `@stapel/docs-react`'s `FileManager`; building a second one here would be
 * two screens to fix every bug in.
 *
 * ── The navigation is the breadcrumb ──────────────────────────────────────
 *
 * Descending pushes the folder that was tapped onto a trail this component
 * holds. The trail is therefore FREE — the row was on screen a moment ago —
 * and it is what the breadcrumb bar draws, so browsing a five-deep drive
 * costs five folder reads and nothing else. Only a cold entry at a folder id
 * (a deep link, a search hit) has no trail, and then the breadcrumb falls
 * back to the docs pair's ancestor walk. One rung per request, never a tree.
 *
 * ── Tabs, not routes ──────────────────────────────────────────────────────
 *
 * Files / Starred / Recent / Trash share this frame: the same rows, the same
 * action sheet, the same upload tray. They are one destination in the nav
 * manifest for that reason.
 */
import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, List, Segmented, Tabs } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { EmptyState, LoadBoundary, SkinDialog, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { useCreateFolder } from "@stapel/docs-react";
import type { DocDocument } from "@stapel/docs-react";
import { NameDialog } from "@stapel/docs-react/default";
import { driveQueryKeys } from "../model/queryKeys.js";
import { DriveList } from "../headless/DriveList.js";
import { UploadTray } from "../headless/UploadTray.js";
import type { UploadTrayBag } from "../headless/UploadTray.js";
import type { DriveRow } from "../headless/rows.js";
import { viewerKindFor } from "../model/viewers.js";
import type { DriveBreadcrumbNode, DriveSearchHit } from "../api/types.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { DriveGridTile, DriveListRow } from "./DriveRow.js";
import { resolveDriveSkinComponent } from "./slots.js";
import { PlusGlyph } from "./icons.js";
import { DRIVE_MEASURE, TILE_MIN_WIDTH } from "./measure.js";

/** The tabs this screen carries. */
export type DriveTab = "files" | "starred" | "recents" | "trash";

export interface DriveScreenProps {
  readonly workspaceId: string;
  /** Start at a folder (a deep link). Default: the workspace root. */
  readonly initialFolderId?: string | null;
  /** A document was opened — route to the docs pair's document surface. */
  onOpenDocument?(documentId: string): void;
  /**
   * Bring your own upload queue instead of the one this screen mounts.
   *
   * The seam exists for a host with a drop-anywhere tray that outlives one
   * screen — a queue shared across routes, so navigating away from the drive
   * does not abort the transfers. It is also what lets a demo photograph the
   * tray mid-flight, which is a consequence of the seam, not its reason.
   */
  readonly uploads?: UploadTrayBag;
  /**
   * Turn a minted share token into the URL people paste, for the share sheet
   * a row action opens. The bearer route is the HOST's — `@stapel/docs-react`'s
   * `<SharedDocumentView>` is the seam it is built on — so this screen forwards
   * the function instead of assembling an origin and a path it cannot know.
   * Omitted, the sheet copies the bare token.
   */
  readonly shareLinkUrl?: (token: string) => string;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

export function DriveScreen(props: DriveScreenProps): ReactElement {
  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <DriveScreenBody {...props} />
    </SkinTheme>
  );
}

function DriveScreenBody(props: DriveScreenProps): ReactElement {
  const t = useT();
  const [tab, setTab] = useState<DriveTab>("files");
  const [view, setView] = useState<"list" | "grid">("list");
  const [folderId, setFolderId] = useState<string | null>(
    props.initialFolderId ?? null
  );
  // The path, accumulated while descending — see the header.
  const [trail, setTrail] = useState<readonly DriveBreadcrumbNode[]>([]);
  // `undefined` = we entered cold at `initialFolderId` and have no trail; the
  // breadcrumb then asks the docs pair to walk the ancestors. `[]` is a real
  // answer (the root), which is why the two are not the same value.
  const trailKnown =
    props.initialFolderId === undefined ||
    props.initialFolderId === null ||
    trail.length > 0;
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Every part goes through the slot registry, so a host replaces one of them
  // (the thumbnail, say, on a header-token deployment) without forking this
  // screen — a default nobody can swap is a decision, not a default.
  const DriveBreadcrumbBar = resolveDriveSkinComponent("breadcrumbBar");
  const DriveRowActions = resolveDriveSkinComponent("rowActions");
  const DriveSearchField = resolveDriveSkinComponent("searchField");
  const DriveTrashPane = resolveDriveSkinComponent("trashPane");
  const RecentsPane = resolveDriveSkinComponent("recentsPane");
  const StarredPane = resolveDriveSkinComponent("starredPane");
  const UploadTrayPanel = resolveDriveSkinComponent("uploadTray");
  const MediaLightboxPanel = resolveDriveSkinComponent("mediaLightbox");
  const ArchiveSheetPanel = resolveDriveSkinComponent("archiveSheet");
  const [actionRow, setActionRow] = useState<DriveRow | null>(null);
  // The open in-place viewer. `viewer` carries the document AND the image
  // siblings captured at open time (the rows were on screen a moment ago —
  // the same "the trail is free" reasoning as the breadcrumb), so swiping
  // never refetches the listing it came from.
  const [viewer, setViewer] = useState<{
    readonly document: DocDocument;
    readonly siblings: readonly DocDocument[];
  } | null>(null);
  const [archiveDoc, setArchiveDoc] = useState<DocDocument | null>(null);
  const [searching, setSearching] = useState(false);
  // The FAB's action sheet (owner escalation 2026-09-02): the FAB used to
  // open the file picker DIRECTLY, which left the drive with no way to make
  // a folder at all. Now it opens a sheet with the two things a person adds
  // to a folder — files, or a folder — and the picker is one tap deeper.
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  // The write is the docs pair's (`POST /folders` — this pair duplicates no
  // mutation). Its own invalidation covers the DOCS keys; the drive listing
  // reads its own per-rung key (`driveQueryKeys.children`), so the rung the
  // person is looking at is invalidated here for the new row to appear.
  const createFolder = useCreateFolder();
  const queryClient = useQueryClient();
  const doCreateFolder = (name: string): void => {
    createFolder.mutate(
      { workspace_id: props.workspaceId, name, parent_id: folderId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: driveQueryKeys.children(props.workspaceId, folderId),
          });
        },
      }
    );
    setNewFolderOpen(false);
  };

  const openRow = (row: DriveRow, siblings: readonly DriveRow[] = []): void => {
    if (row.kind === "folder") {
      setFolderId(row.id);
      setTrail((current) => [...current, { id: row.id, name: row.name }]);
      return;
    }
    // Viewable files open IN PLACE (viewing wave, stapel-docs 0.8.0): a
    // photo in the lightbox with its listing-mates to swipe through, audio
    // and video as players, a zip as the archive sheet. Everything else —
    // editable documents above all — keeps routing to the host's document
    // surface, exactly as before: the viewers are additive.
    const kind = viewerKindFor(row.document);
    if (kind === "archive") {
      setArchiveDoc(row.document);
      return;
    }
    if (kind !== null) {
      setViewer({
        document: row.document,
        siblings: siblings
          .filter((sibling) => sibling.kind === "document")
          .map((sibling) => sibling.document),
      });
      return;
    }
    props.onOpenDocument?.(row.id);
  };

  const selectFolder = (nextId: string | null): void => {
    setFolderId(nextId);
    setTrail((current) => {
      if (nextId === null) return [];
      const at = current.findIndex((node) => node.id === nextId);
      return at === -1 ? current : current.slice(0, at + 1);
    });
  };

  const openHit = (hit: DriveSearchHit): void => {
    setSearching(false);
    // The hit's breadcrumb is the container's chain; a folder hit adds itself
    // to it, a document hit lands in the folder that holds it.
    const container = hit.breadcrumb ?? [];
    if (hit.kind === "folder") {
      setTrail([...container, { id: hit.id, name: hit.name }]);
      setFolderId(hit.id);
      return;
    }
    setTrail(container);
    setFolderId(hit.parent_id ?? null);
    props.onOpenDocument?.(hit.id);
  };

  /** The FAB, its hidden picker, and the tray under them. */
  const uploadArea = (bag: UploadTrayBag): ReactElement => (
    <Flex vertical gap={spacing[2]}>
      <Flex justify="flex-end">
        {/* The FAB. A label, not an icon alone: the one primary action of the
            screen is worth the width, and an icon-only control would need a
            name nobody reads out loud anyway. It opens the CREATE SHEET, not
            the picker: "upload files" and "new folder" are peers, and a FAB
            that is secretly only a picker forecloses the second one. */}
        <Button
          type="primary"
          icon={<PlusGlyph />}
          data-testid="drive-upload-fab"
          data-analytics="none"
          data-analytics-reason="opens the create sheet — the upload/create itself is the tracked outcome, and the host app wraps it with its own tracked()"
          onClick={() => {
            setCreateSheetOpen(true);
          }}
        >
          {t(DRIVE_I18N_KEYS.createLabel)}
        </Button>
        <input
          type="file"
          multiple
          hidden
          aria-hidden
          data-testid="drive-upload-input"
          ref={fileInput}
          onChange={(event) => {
            const picked = event.target.files;
            if (picked !== null) bag.add([...picked]);
            event.target.value = "";
          }}
        />
      </Flex>
      {bag.items.length > 0 && <UploadTrayPanel bag={bag} />}
    </Flex>
  );

  const files = (
    <DriveList workspaceId={props.workspaceId} folderId={folderId}>
      {(bag) => (
        <Flex vertical gap={spacing[3]}>
          <Flex justify="flex-end">
            <Segmented<"list" | "grid">
              value={view}
              onChange={setView}
              data-testid="drive-view-toggle"
              options={[
                { value: "list", label: t(DRIVE_I18N_KEYS.viewList) },
                { value: "grid", label: t(DRIVE_I18N_KEYS.viewGrid) },
              ]}
            />
          </Flex>
          <LoadBoundary
            state={bag.state}
            onRetry={bag.refetch}
            testId="drive-listing"
          >
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState
                  title={t(DRIVE_I18N_KEYS.listEmpty)}
                  hint={t(DRIVE_I18N_KEYS.listEmptyHint)}
                  testId="drive-listing-empty"
                  action={
                    // The SAME sheet as the FAB — one affordance, one
                    // behaviour. A second, bare picker here would put two
                    // different answers behind the same word.
                    <Button
                      type="primary"
                      data-testid="drive-empty-upload"
                      data-analytics="none"
                      data-analytics-reason="opens the create sheet — the upload/create itself is the tracked outcome, and the host app wraps it with its own tracked()"
                      onClick={() => {
                        setCreateSheetOpen(true);
                      }}
                    >
                      {t(DRIVE_I18N_KEYS.uploadAction)}
                    </Button>
                  }
                />
              ) : view === "grid" ? (
                <div
                  data-testid="drive-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(auto-fill, minmax(${String(TILE_MIN_WIDTH)}px, 1fr))`,
                    gap: spacing[3],
                  }}
                >
                  {rows.map((row) => (
                    <DriveGridTile
                      key={`${row.kind}:${row.id}`}
                      row={row}
                      onOpen={(opened) => {
                        openRow(opened, rows);
                      }}
                      onActions={setActionRow}
                      onToggleStar={bag.toggleStar}
                    />
                  ))}
                </div>
              ) : (
                <List
                  dataSource={[...rows]}
                  rowKey={(row: DriveRow) => `${row.kind}:${row.id}`}
                  data-testid="drive-list"
                  renderItem={(row: DriveRow) => (
                    <DriveListRow
                      key={`${row.kind}:${row.id}`}
                      row={row}
                      onOpen={(opened) => {
                        openRow(opened, rows);
                      }}
                      onActions={setActionRow}
                      onToggleStar={bag.toggleStar}
                    />
                  )}
                />
              )
            }
          </LoadBoundary>
        </Flex>
      )}
    </DriveList>
  );

  return (
    <Flex
      vertical
      gap={spacing[3]}
      data-testid="drive-screen"
      style={{ maxWidth: DRIVE_MEASURE, width: "100%", margin: "0 auto" }}
    >
      <DriveBreadcrumbBar
        workspaceId={props.workspaceId}
        folderId={folderId}
        {...(trailKnown ? { trail } : {})}
        onSelectFolder={selectFolder}
      />

      <Button
        type="text"
        data-testid="drive-search-toggle"
        data-analytics="none"
        data-analytics-reason="reveals the search field within the surface — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        onClick={() => {
          setSearching((current) => !current);
        }}
      >
        {t(DRIVE_I18N_KEYS.searchLabel)}
      </Button>
      {searching && (
        <DriveSearchField workspaceId={props.workspaceId} onOpenHit={openHit} />
      )}

      <Tabs
        activeKey={tab}
        onChange={(key) => {
          setTab(key as DriveTab);
        }}
        data-testid="drive-tabs"
        items={[
          { key: "files", label: t(DRIVE_I18N_KEYS.tabFiles), children: files },
          {
            key: "starred",
            label: t(DRIVE_I18N_KEYS.tabStarred),
            children: (
              <StarredPane
                workspaceId={props.workspaceId}
                onOpen={openRow}
                onActions={setActionRow}
              />
            ),
          },
          {
            key: "recents",
            label: t(DRIVE_I18N_KEYS.tabRecents),
            children: (
              <RecentsPane
                workspaceId={props.workspaceId}
                onOpen={openRow}
                onActions={setActionRow}
              />
            ),
          },
          {
            key: "trash",
            label: t(DRIVE_I18N_KEYS.tabTrash),
            children: <DriveTrashPane workspaceId={props.workspaceId} />,
          },
        ]}
      />

      {props.uploads !== undefined ? (
        uploadArea(props.uploads)
      ) : (
        <UploadTray
          workspaceId={props.workspaceId}
          folderId={folderId ?? undefined}
        >
          {uploadArea}
        </UploadTray>
      )}

      <MediaLightboxPanel
        document={viewer?.document ?? null}
        siblings={viewer?.siblings ?? []}
        onClose={() => {
          setViewer(null);
        }}
        onNavigate={(next) => {
          setViewer((current) =>
            current === null ? null : { ...current, document: next }
          );
        }}
      />

      <ArchiveSheetPanel
        documentId={archiveDoc?.id ?? null}
        {...(archiveDoc !== null ? { title: archiveDoc.title } : {})}
        onClose={() => {
          setArchiveDoc(null);
        }}
      />

      <DriveRowActions
        workspaceId={props.workspaceId}
        row={actionRow}
        onOpen={openRow}
        {...(props.shareLinkUrl !== undefined
          ? { shareLinkUrl: props.shareLinkUrl }
          : {})}
        onClose={() => {
          setActionRow(null);
        }}
      />

      {/* The create sheet — the same bottom-sheet shape as the row actions
          (`SkinDialog` decides sheet-vs-modal once for the fleet). Two
          actions, thumb-sized rows. */}
      <SkinDialog
        open={createSheetOpen}
        onClose={() => {
          setCreateSheetOpen(false);
        }}
        title={t(DRIVE_I18N_KEYS.createLabel)}
        dismissLabel={t(DRIVE_I18N_KEYS.createLabel)}
        data-testid="drive-create-sheet"
      >
        <Flex vertical gap={spacing[2]} style={{ paddingBlock: spacing[2] }}>
          <Button
            type="text"
            style={{ width: "100%", justifyContent: "flex-start" }}
            data-testid="drive-create-upload"
            data-analytics="none"
            data-analytics-reason="opens the file picker — the upload itself is the tracked outcome, and the host app wraps it with its own tracked()"
            onClick={() => {
              setCreateSheetOpen(false);
              fileInput.current?.click();
            }}
          >
            {t(DRIVE_I18N_KEYS.createUploadFiles)}
          </Button>
          <Button
            type="text"
            style={{ width: "100%", justifyContent: "flex-start" }}
            data-testid="drive-create-folder"
            data-analytics="none"
            data-analytics-reason="opens the name prompt — the confirmed create carries the tracked action, and the host app wraps it with its own tracked()"
            onClick={() => {
              setCreateSheetOpen(false);
              setNewFolderOpen(true);
            }}
          >
            {t(DRIVE_I18N_KEYS.createNewFolder)}
          </Button>
        </Flex>
      </SkinDialog>

      {/* The new-folder prompt — the docs pair's `NameDialog`, exactly the
          rename prompt's shape, with this pair's copy passed in as keys. */}
      <NameDialog
        open={newFolderOpen}
        titleKey={DRIVE_I18N_KEYS.newFolderTitle}
        confirmKey={DRIVE_I18N_KEYS.newFolderSubmit}
        initialValue=""
        busy={createFolder.isPending}
        onConfirm={doCreateFolder}
        onClose={() => {
          setNewFolderOpen(false);
        }}
      />
    </Flex>
  );
}
