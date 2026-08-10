/**
 * `<TrashPane/>` — the default skin's trash view: the `TrashBin` headless
 * bag rendered through core's `matchLoad` (trashed folders, then trashed
 * documents — the backend's real `{folders, documents}` shape), with a
 * per-item context menu (restore / delete forever — `POST /trash/empty` ids
 * target both kinds) and an "Empty trash" header button behind a confirm.
 *
 * Replaceable without a fork: `FileManager` resolves this pane through the
 * skin slot registry (`registerDocsSkinComponent("fileManager.trashPane", …)`).
 */
import type { ReactElement, ReactNode } from "react";
import {
  Button,
  Dropdown,
  Empty,
  Flex,
  List,
  Popconfirm,
  Spin,
  Typography,
} from "antd";
import { matchLoad, useErrorDisplay, useT } from "@stapel/core";
import { TrashBin } from "../headless/TrashBin.js";
import type { TrashBag } from "../headless/TrashBin.js";
import type { TrashListing } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface TrashPaneProps {
  readonly workspaceId: string;
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
  const t = useT();
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);

  function item(bag: TrashBag, row: TrashRow): ReactNode {
    return (
      <Dropdown
        trigger={["contextMenu"]}
        menu={{
          items: [
            { key: "restore", label: t(DOCS_I18N_KEYS.menuRestore) },
            { type: "divider" as const },
            // `POST /trash/empty` ids target folders AND documents
            // (services.empty_trash filters both sets), so per-item
            // delete-forever is offered on either kind.
            {
              key: "purge",
              label: t(DOCS_I18N_KEYS.menuDeleteForever),
              danger: true,
            },
          ],
          onClick: ({ key }) => {
            if (key === "restore") {
              if (row.kind === "folder") bag.restoreFolder(row.id);
              else bag.restoreDocument(row.id);
            } else if (key === "purge") {
              bag.emptyTrash([row.id]);
            }
          },
        }}
      >
        <List.Item data-docs-trash-item={row.id}>
          <List.Item.Meta
            title={row.name}
            description={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
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
    <TrashBin workspaceId={props.workspaceId}>
      {(bag) => {
        const hasRows =
          bag.state.status === "ready" && toRows(bag.state.data).length > 0;
        return (
          <Flex vertical gap="small" data-testid="docs-trash-pane">
            <Flex justify="flex-end">
              <Popconfirm
                title={t(DOCS_I18N_KEYS.trashEmptyConfirm)}
                okText={t(DOCS_I18N_KEYS.dialogOk)}
                cancelText={t(DOCS_I18N_KEYS.dialogCancel)}
                onConfirm={() => {
                  bag.emptyTrash();
                }}
              >
                <Button
                  danger
                  size="small"
                  loading={bag.isEmptying}
                  disabled={!hasRows}
                  data-analytics="none"
                  data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                >
                  {t(DOCS_I18N_KEYS.trashEmptyAction)}
                </Button>
              </Popconfirm>
            </Flex>

            {bag.writeError !== null && (
              <ErrorAlert
                error={errorDisplay(bag.writeError)}
                testId="docs-trash-error"
              />
            )}

            {matchLoad(bag.state, {
              loading: () => <Spin />,
              failed: (error) => (
                <ErrorAlert
                  error={errorDisplay(error)}
                  testId="docs-trash-load-error"
                />
              ),
              ready: (listing) => {
                const rows = toRows(listing);
                return rows.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t(DOCS_I18N_KEYS.trashEmptyState)}
                  />
                ) : (
                  <List<TrashRow>
                    dataSource={rows}
                    rowKey={(trashRow) => trashRow.id}
                    renderItem={(trashRow) => item(bag, trashRow)}
                  />
                );
              },
            })}
          </Flex>
        );
      }}
    </TrashBin>
  );
}
