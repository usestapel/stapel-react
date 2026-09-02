/**
 * `<DriveRowActions/>` — everything a row can have done to it, as a bottom
 * sheet.
 *
 * ── Why a sheet and not a menu ────────────────────────────────────────────
 *
 * The docs pair's file manager reaches row actions through a right-click
 * context menu with a keyboard-reachable overflow twin — correct for the
 * two-pane desktop surface it is. There is no right-click on a phone, and an
 * anchored dropdown opened on the last row of a 390px screen renders its items
 * against the bottom edge at 22px tall. So the drive product's row actions are
 * a `SkinDialog` sheet: full width, thumb-sized rows, opened by a tap on the
 * row's overflow control.
 *
 * ── What it does NOT re-implement ─────────────────────────────────────────
 *
 * Every write is `@stapel/docs-react`'s: `useUpdateDocument`/`useUpdateFolder`
 * for rename AND move (a PATCH on the object is the move — the backend has no
 * separate route), `useTrashDocument`/`useTrashFolder` for the trash, and
 * `useExportUrl` to mint the download. The rename and move PROMPTS are that
 * pair's `NameDialog`/`MoveDialog` too, with this pair's copy passed in as
 * keys. The only write this component owns is the star, which is new in 0.5.0
 * and lives here (`useToggleStar`, optimistic).
 *
 * The move picker needs the workspace's folder list, which is the one place
 * the drive's per-rung discipline does not apply: a destination picker must
 * offer destinations the person has never opened. It is read on demand —
 * `useFolders` runs only while the move dialog is open — so browsing still
 * costs one request per rung and only an actual move pays for the tree.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("rowActions", …)`.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import { ErrorAlert, SkinDialog, SkinTheme, SkinConfirm } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { spacing } from "@stapel/tokens-antd";
import { loadedRowsOrEmpty, loadStateFromQuery, useT } from "@stapel/core";
import {
  MoveDialog,
  NameDialog,
  RevisionsModal,
} from "@stapel/docs-react/default";
import {
  useExportUrl,
  useFolders,
  useTrashDocument,
  useTrashFolder,
  useUpdateDocument,
  useUpdateFolder,
} from "@stapel/docs-react";
import type { DriveRow } from "../headless/rows.js";
import { useToggleStar } from "../model/mutations.js";
import { driveQueryKeys } from "../model/queryKeys.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { resolveDriveSkinComponent } from "./slots.js";

export interface DriveRowActionsProps {
  readonly workspaceId: string;
  /** The row the sheet acts on; `null` closes it. */
  readonly row: DriveRow | null;
  onClose(): void;
  /** Open the row (a folder navigates, a document routes to the docs pair). */
  onOpen?(row: DriveRow): void;
  /**
   * Turn a minted share token into the URL people paste. Forwarded to the
   * share sheet — the bearer route belongs to the HOST (see
   * `ShareSheetPanel`), so this package never assembles one.
   */
  readonly shareLinkUrl?: (token: string) => string;
  /** Pin a theme side. Omitted, the document's live mode wins — this is a
   * dialog, which portals out of the tree and would otherwise be served
   * antd's compiled-in light palette. */
  readonly mode?: ThemeMode;
}

type Prompt = "none" | "rename" | "move" | "trash" | "share" | "history";

export function DriveRowActions(props: DriveRowActionsProps): ReactElement {
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <DriveRowActionsBody {...props} />
    </SkinTheme>
  );
}

/** The sheet itself — a component so the hooks run at a component's top level. */
function DriveRowActionsBody(props: DriveRowActionsProps): ReactElement {
  const t = useT();
  const [prompt, setPrompt] = useState<Prompt>("none");
  const { row, onClose } = props;
  // Through the registry, so a host that swapped the share sheet gets ITS
  // sheet from the row action too — a slot resolved at one call site and
  // hardcoded at another is a slot only half the product honours. Named for
  // the SKIN component, not for the docs pair's headless `ShareSheet` it is
  // drawn over: two different things, and one name for both is how a reader
  // ends up looking for a render prop on a dialog.
  const ShareSheetPanel = resolveDriveSkinComponent("shareSheet");

  const queryClient = useQueryClient();
  const renameDocument = useUpdateDocument();
  const renameFolder = useUpdateFolder();
  const trashDocument = useTrashDocument();
  const trashFolder = useTrashFolder();
  const exportUrl = useExportUrl();
  const toggleStar = useToggleStar();

  // The destination list is read ONLY while the move prompt is open — the
  // whole-tree read the rest of this product deliberately avoids. Gated by
  // handing the hook an empty scope until then (its own `enabled` rule):
  // ungated, this tree read fired the moment ANY row's sheet opened and
  // landed mid-settle of whatever prompt the person actually chose — one of
  // the stray reads that kept the share sheet re-rendering on a live stand
  // (live drive e2e walk, 2026-09-02).
  const folders = useFolders(prompt === "move" ? props.workspaceId : "");

  const isFolder = row?.kind === "folder";
  const busy =
    renameDocument.isPending ||
    renameFolder.isPending ||
    trashDocument.isPending ||
    trashFolder.isPending;

  const close = (): void => {
    setPrompt("none");
    // A dismissed sheet must not reopen still wearing the last refusal.
    renameDocument.reset();
    renameFolder.reset();
    onClose();
  };

  /**
   * The rename settles WITH the write, not before it (live drive e2e walk,
   * 2026-09-02 — two live defects):
   *
   *  - The PATCH is the docs pair's and invalidates only the DOCS keys. A
   *    folder row is drawn from THIS pair's per-rung read
   *    (`driveQueryKeys.children`), and a document's name also rides the
   *    drive-only starred/search reads — so on success the drive namespace
   *    is dropped here, the same mechanism create-folder and the upload
   *    queue already use, and the row shows its new name without a reload.
   *  - Closing used to happen in the same tick as `mutate`, so a refused
   *    rename vanished without a trace. Now the prompt stays up (busy) while
   *    the request is in flight, everything closes only on success, and a
   *    refusal returns to the actions sheet with the refusal's own sentence
   *    (`drive-rename-error`) — retry and dismiss both stay reachable.
   */
  const doRename = (name: string): void => {
    if (row === null) return;
    const settled = {
      onSuccess: (): void => {
        void queryClient.invalidateQueries({ queryKey: driveQueryKeys.all });
        close();
      },
      onError: (): void => {
        // Back to the actions sheet, which renders the reason.
        setPrompt("none");
      },
    };
    if (row.kind === "folder") {
      renameFolder.mutate({ folderId: row.id, patch: { name } }, settled);
    } else {
      renameDocument.mutate({ documentId: row.id, patch: { title: name } }, settled);
    }
  };

  const doMove = (destinationId: string | null): void => {
    if (row === null) return;
    if (row.kind === "folder") {
      renameFolder.mutate({
        folderId: row.id,
        patch: { parent_id: destinationId },
      });
    } else {
      renameDocument.mutate({
        documentId: row.id,
        patch: { folder_id: destinationId },
      });
    }
    close();
  };

  const doTrash = (): void => {
    if (row === null) return;
    if (row.kind === "folder") trashFolder.mutate(row.id);
    else trashDocument.mutate(row.id);
    close();
  };

  const doDownload = (): void => {
    if (row === null || row.kind !== "document") return;
    exportUrl.mutate(
      { documentId: row.id },
      {
        onSuccess: (url) => {
          // The URL is opaque and may expire, so it is minted on the click
          // and handed straight to the browser — never stored in a href that
          // goes stale in the DOM.
          globalThis.open(url, "_blank", "noopener");
        },
      }
    );
    close();
  };

  const starred = row?.isStarred === true;
  const actionStyle = { width: "100%", justifyContent: "flex-start" as const };

  return (
    <>
      <SkinDialog
        open={row !== null && prompt === "none"}
        onClose={close}
        title={row?.name ?? t(DRIVE_I18N_KEYS.actionsLabel)}
        dismissLabel={t(DRIVE_I18N_KEYS.actionsLabel)}
        data-testid="drive-row-actions"
      >
        <Flex vertical gap={spacing[2]} style={{ paddingBlock: spacing[2] }}>
          {/* A refused rename lands back here as its own sentence (see
              `doRename`) — the sheet stays open, retry and dismiss both
              reachable. `ErrorAlert` renders nothing while there is no
              refusal to show. */}
          <ErrorAlert
            thrown={renameFolder.error ?? renameDocument.error}
            variant="inline"
            testId="drive-rename-error"
          />
          <Button
            type="text"
            style={actionStyle}
            data-testid="drive-action-open"
            data-analytics="none"
            data-analytics-reason="the host app wraps drive row actions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            onClick={() => {
              if (row !== null) props.onOpen?.(row);
              close();
            }}
          >
            {t(DRIVE_I18N_KEYS.actionOpen)}
          </Button>
          <Button
            type="text"
            style={actionStyle}
            data-testid="drive-action-star"
            data-analytics="none"
            data-analytics-reason="the host app wraps drive row actions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            onClick={() => {
              if (row !== null) {
                toggleStar.mutate({
                  target: { kind: row.kind, id: row.id },
                  starred: !starred,
                });
              }
              close();
            }}
          >
            {t(starred ? DRIVE_I18N_KEYS.unstar : DRIVE_I18N_KEYS.star)}
          </Button>
          <Button
            type="text"
            style={actionStyle}
            data-testid="drive-action-rename"
            data-analytics="none"
            data-analytics-reason="the host app wraps drive row actions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            onClick={() => {
              setPrompt("rename");
            }}
          >
            {t(DRIVE_I18N_KEYS.actionRename)}
          </Button>
          <Button
            type="text"
            style={actionStyle}
            data-testid="drive-action-move"
            data-analytics="none"
            data-analytics-reason="the host app wraps drive row actions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            onClick={() => {
              setPrompt("move");
            }}
          >
            {t(DRIVE_I18N_KEYS.actionMove)}
          </Button>
          {!isFolder && (
            <Button
              type="text"
              style={actionStyle}
              loading={exportUrl.isPending}
              data-testid="drive-action-download"
              data-analytics="none"
              data-analytics-reason="the host app wraps drive row actions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
              onClick={doDownload}
            >
              {t(DRIVE_I18N_KEYS.actionDownload)}
            </Button>
          )}
          {!isFolder && (
            <Button
              type="text"
              style={actionStyle}
              data-testid="drive-action-history"
              data-analytics="none"
              data-analytics-reason="the host app wraps drive row actions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
              onClick={() => {
                setPrompt("history");
              }}
            >
              {t(DRIVE_I18N_KEYS.actionHistory)}
            </Button>
          )}
          {!isFolder && (
            <Button
              type="text"
              style={actionStyle}
              data-testid="drive-action-share"
              data-analytics="none"
              data-analytics-reason="the host app wraps drive row actions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
              onClick={() => {
                setPrompt("share");
              }}
            >
              {t(DRIVE_I18N_KEYS.actionShare)}
            </Button>
          )}
          <Button
            type="text"
            danger
            style={actionStyle}
            data-testid="drive-action-trash"
            data-analytics="none"
            data-analytics-reason="opens the destructive confirmation — the confirmed trash carries the tracked action"
            onClick={() => {
              setPrompt("trash");
            }}
          >
            {t(DRIVE_I18N_KEYS.actionTrash)}
          </Button>
        </Flex>
      </SkinDialog>

      <NameDialog
        open={row !== null && prompt === "rename"}
        titleKey={DRIVE_I18N_KEYS.renameTitle}
        confirmKey={DRIVE_I18N_KEYS.renameSubmit}
        initialValue={row?.name ?? ""}
        busy={busy}
        onConfirm={doRename}
        onClose={close}
      />

      <MoveDialog
        open={row !== null && prompt === "move"}
        folders={loadedRowsOrEmpty(loadStateFromQuery(folders))}
        currentParentId={
          row?.kind === "folder"
            ? (row.folder.parent_id ?? null)
            : (row?.document.folder_id ?? null)
        }
        // A folder cannot be moved into itself; deeper descendants are refused
        // by the backend, which owns the cycle rule.
        excludedIds={new Set(row?.kind === "folder" ? [row.id] : [])}
        busy={busy}
        onConfirm={doMove}
        onClose={close}
      />

      {/* Version history — the docs pair's finished modal: nothing of the
          revision surface is re-implemented here. Since docs-react's viewing
          slice it previews an OLD revision of a media file inline
          (image/audio/video via the authorized revision content stream),
          which is what makes History a row action worth having on a drive
          full of binaries.

          Mounted ON DEMAND, unlike NameDialog/MoveDialog: the modal's own
          `useDocument` read is not gated on `open`, so keeping it mounted
          for every document row re-read `GET /documents/:id` the moment the
          sheet opened — the second stray settle that kept the share sheet
          re-rendering on a live stand (live drive e2e walk, 2026-09-02). */}
      {row !== null && row.kind === "document" && prompt === "history" && (
        <RevisionsModal documentId={row.id} open onClose={close} />
      )}

      <ShareSheetPanel
        documentId={
          row !== null && row.kind === "document" && prompt === "share"
            ? row.id
            : null
        }
        {...(row !== null ? { title: row.name } : {})}
        {...(props.shareLinkUrl !== undefined
          ? { linkUrl: props.shareLinkUrl }
          : {})}
        onClose={close}
      />

      <SkinConfirm
        open={row !== null && prompt === "trash"}
        danger
        title={t(DRIVE_I18N_KEYS.trashConfirm)}
        body={row?.name}
        confirmLabel={t(DRIVE_I18N_KEYS.actionTrash)}
        confirming={busy}
        onConfirm={doTrash}
        onCancel={close}
        data-testid="drive-trash-confirm"
      />
    </>
  );
}
