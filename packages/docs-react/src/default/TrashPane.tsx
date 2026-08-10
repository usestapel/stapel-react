/**
 * `<TrashPane/>` — the default skin's trash view: the `TrashBin` headless
 * bag rendered through core's `matchLoad` (trashed folders, then trashed
 * documents — the backend's real `{folders, documents}` shape), with a
 * per-item context menu (restore / delete forever — `POST /trash/empty` ids
 * target both kinds) and an "Empty trash" header button behind a confirm.
 *
 * "Empty trash" is switched off through core's `useActionGate`, which is why
 * the reason is on screen: the button used to grey out on `rows.length === 0`,
 * which is equally true when the trash read FAILED — an outage wearing the
 * costume of an empty trash.
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
import {
  actionAvailable,
  actionBlocked,
  matchLoad,
  requireLoaded,
  useActionGate,
  useErrorDisplay,
  useT,
} from "@stapel/core";
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
  return (
    <TrashBin workspaceId={props.workspaceId}>
      {(bag) => <TrashPaneBody bag={bag} />}
    </TrashBin>
  );
}

/** The pane itself — a component, not a closure, so the gate hook runs at a
 * component's top level rather than inside the render prop. */
function TrashPaneBody(props: { readonly bag: TrashBag }): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);
  const { bag } = props;
  // Three reasons the button can be off, and the person is told which:
  // still reading, the read failed, or the trash is genuinely empty.
  const emptyTrash = useActionGate(
    requireLoaded(bag.state, (listing) =>
      toRows(listing).length === 0
        ? actionBlocked(DOCS_I18N_KEYS.trashEmptyBlocked)
        : actionAvailable()
    )
  );

  function item(row: TrashRow): ReactNode {
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
    <Flex vertical gap="small" data-testid="docs-trash-pane">
      <Flex justify="flex-end" align="center" gap="small">
        {/* Beside the control, not in a `title`: a disabled button gets no
            pointer events, so a tooltip is a reason nobody can read. */}
        {emptyTrash.reason !== undefined && (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12 }}
            data-testid="docs-trash-empty-reason"
          >
            {emptyTrash.reason}
            {emptyTrash.detail !== undefined ? ` · ${emptyTrash.detail}` : ""}
          </Typography.Text>
        )}
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
            disabled={emptyTrash.disabled}
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
              renderItem={item}
            />
          );
        },
      })}
    </Flex>
  );
}
