/**
 * `<TrashPane/>` — the default skin's trash view: the `TrashBin` headless
 * bag rendered through the shared `<LoadBoundary>` (trashed folders, then
 * trashed documents — the backend's real `{folders, documents}` shape), with
 * a per-item menu (restore / delete forever — `POST /trash/empty` ids target
 * both kinds) reachable by click AND right-click, and an "Empty trash" header
 * button behind a confirmation.
 *
 * The confirmation is `SkinConfirm`, which is a bottom sheet on a phone: a
 * `Popconfirm` is an anchored popover that opens against the edge of a 390px
 * screen and puts two 22px buttons under a thumb, for the one action in this
 * pane that cannot be undone.
 *
 * "Empty trash" is switched off through `GatedButton`, which is why the
 * reason is on screen: the button used to grey out on `rows.length === 0`,
 * which is equally true when the trash read FAILED — an outage wearing the
 * costume of an empty trash.
 *
 * Replaceable without a fork: `FileManager` resolves this pane through the
 * skin slot registry (`registerDocsSkinComponent("fileManager.trashPane", …)`).
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Dropdown, Flex, List, Typography } from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import {
  actionAvailable,
  actionBlocked,
  requireLoaded,
  useT,
} from "@stapel/core";
import { fontSize } from "@stapel/tokens";
import { TrashBin } from "../headless/TrashBin.js";
import type { TrashBag } from "../headless/TrashBin.js";
import type { TrashListing } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { RowActions } from "./RowActions.js";
import { READING_MEASURE } from "./measure.js";

export interface TrashPaneProps {
  readonly workspaceId: string;
  /** Pin a theme side. Omitted, the document's live mode wins — the pane
   * self-themes, and its confirmations are dialogs, which portal out of this
   * tree and would otherwise be served antd's compiled-in light palette. */
  readonly mode?: ThemeMode;
}

interface TrashRow {
  readonly id: string;
  readonly name: string;
  readonly kind: "folder" | "document";
}

function toRows(listing: TrashListing): TrashRow[] {
  return [
    ...listing.folders.map(
      (folder): TrashRow => ({ id: folder.id, name: folder.name, kind: "folder" })
    ),
    ...listing.documents.map(
      (doc): TrashRow => ({ id: doc.id, name: doc.title, kind: "document" })
    ),
  ];
}

export function TrashPane(props: TrashPaneProps): ReactElement {
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <TrashBin workspaceId={props.workspaceId}>
        {(bag) => <TrashPaneBody bag={bag} />}
      </TrashBin>
    </SkinTheme>
  );
}

/** The pane itself — a component, not a closure, so the hooks run at a
 * component's top level rather than inside the render prop. */
function TrashPaneBody(props: { readonly bag: TrashBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  // Which single item a delete-forever is being confirmed for. One dialog per
  // list, keyed by the pending id — never one dialog per row.
  const [purgingRow, setPurgingRow] = useState<TrashRow | null>(null);

  // Three reasons the button can be off, and the person is told which:
  // still reading, the read failed, or the trash is genuinely empty.
  const emptyTrash = requireLoaded(bag.state, (listing) =>
    toRows(listing).length === 0
      ? actionBlocked(DOCS_I18N_KEYS.trashEmptyBlocked)
      : actionAvailable()
  );

  function item(row: TrashRow): ReactNode {
    const menu = {
      items: [
        { key: "restore", label: t(DOCS_I18N_KEYS.menuRestore) },
        { type: "divider" as const, key: "sep" },
        // `POST /trash/empty` ids target folders AND documents
        // (services.empty_trash filters both sets), so per-item
        // delete-forever is offered on either kind.
        {
          key: "purge",
          label: t(DOCS_I18N_KEYS.menuDeleteForever),
          danger: true,
        },
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === "restore") {
          if (row.kind === "folder") bag.restoreFolder(row.id);
          else bag.restoreDocument(row.id);
        } else if (key === "purge") {
          setPurgingRow(row);
        }
      },
    };
    return (
      <Dropdown trigger={["contextMenu"]} menu={menu}>
        <List.Item
          data-docs-trash-item={row.id}
          actions={[
            <RowActions
              key="actions"
              menu={menu}
              label={t(DOCS_I18N_KEYS.menuActions)}
              dataAttribute={{ "data-docs-trash-actions": row.id }}
            />,
          ]}
        >
          <List.Item.Meta
            title={row.name}
            description={
              <Typography.Text
                type="secondary"
                style={{ fontSize: fontSize.xs.fontSize }}
              >
                {row.kind === "folder"
                  ? t(DOCS_I18N_KEYS.trashKindFolder)
                  : t(DOCS_I18N_KEYS.trashKindDocument)}
              </Typography.Text>
            }
          />
        </List.Item>
      </Dropdown>
    );
  }

  return (
    <Flex
      vertical
      gap="small"
      data-testid="docs-trash-pane"
      style={{ maxWidth: READING_MEASURE, width: "100%" }}
    >
      <Flex justify="flex-end" align="center" gap="small" wrap>
        <GatedButton
          gate={emptyTrash}
          danger
          loading={bag.isEmptying}
          onClick={() => {
            setConfirmingEmpty(true);
          }}
          testId="docs-trash-empty"
          data-analytics="none"
          data-analytics-reason="opens the destructive confirmation — the confirmed purge carries the tracked action"
        >
          {t(DOCS_I18N_KEYS.trashEmptyAction)}
        </GatedButton>
      </Flex>

      <ErrorAlert thrown={bag.writeError} testId="docs-trash-error" />

      <LoadBoundary state={bag.state} onRetry={bag.refetch} testId="docs-trash">
        {(listing) => {
          const rows = toRows(listing);
          return rows.length === 0 ? (
            <EmptyState
              title={t(DOCS_I18N_KEYS.trashEmptyState)}
              hint={t(DOCS_I18N_KEYS.trashEmptyHint)}
              testId="docs-trash-empty-state"
            />
          ) : (
            <List<TrashRow>
              dataSource={rows}
              rowKey={(trashRow) => trashRow.id}
              renderItem={item}
            />
          );
        }}
      </LoadBoundary>

      <SkinConfirm
        open={confirmingEmpty}
        danger
        title={t(DOCS_I18N_KEYS.trashEmptyConfirm)}
        confirmLabel={t(DOCS_I18N_KEYS.trashEmptyAction)}
        confirming={bag.isEmptying}
        onConfirm={() => {
          bag.emptyTrash();
          setConfirmingEmpty(false);
        }}
        onCancel={() => {
          setConfirmingEmpty(false);
        }}
        data-testid="docs-trash-empty-confirm"
      />

      <SkinConfirm
        open={purgingRow !== null}
        danger
        title={t(DOCS_I18N_KEYS.menuDeleteForever)}
        body={purgingRow?.name}
        confirmLabel={t(DOCS_I18N_KEYS.menuDeleteForever)}
        confirming={bag.isEmptying}
        onConfirm={() => {
          if (purgingRow !== null) bag.emptyTrash([purgingRow.id]);
          setPurgingRow(null);
        }}
        onCancel={() => {
          setPurgingRow(null);
        }}
        data-testid="docs-trash-purge-confirm"
      />
    </Flex>
  );
}
