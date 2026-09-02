/**
 * The two ways one {@link DriveRow} is drawn — a list row and a grid tile.
 *
 * Internal to the skin on purpose (not on the `/default` barrel): they are
 * parts of the listing, not surfaces a host mounts, and the swappable seam is
 * the listing itself. Keeping them here is what stops the list and the grid
 * from drifting into two different ideas of what a starred folder looks like.
 *
 * Both are whole-row buttons: the tap target for "open this" is the row, not
 * a link inside it, because a 44px row that only reacts on its 14px title is
 * the single most common phone-list defect. The star and the overflow are
 * separate controls inside it with their own accessible names
 * (`stapel/icon-button-needs-label`), and they stop the event from opening
 * the row.
 */
import type { ReactElement } from "react";
import { Button, Flex, Typography, theme as antdTheme } from "antd";
import { ListRow } from "@stapel/tokens-antd/skin";
import { fontSize, radii, spacing } from "@stapel/tokens-antd";
import { useI18n, useT } from "@stapel/core";
import { formatBytes, formatDate } from "@stapel/docs-react";
import type { DriveRow } from "../headless/rows.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { DriveThumbnail } from "./DriveThumbnail.js";
import { FolderGlyph, MoreGlyph, StarGlyph } from "./icons.js";
import { ROW_THUMBNAIL, TILE_THUMBNAIL } from "./measure.js";

export interface DriveRowViewProps {
  readonly row: DriveRow;
  onOpen(row: DriveRow): void;
  onActions(row: DriveRow): void;
  onToggleStar(row: DriveRow, starred: boolean): void;
}

/** The leading square: a folder glyph, or the document's thumbnail. */
function Leading(props: {
  readonly row: DriveRow;
  readonly size: number;
}): ReactElement {
  const { token } = antdTheme.useToken();
  if (props.row.kind === "folder") {
    return (
      <Flex
        align="center"
        justify="center"
        style={{
          width: props.size,
          height: props.size,
          borderRadius: radii.sm,
          background: token.colorFillTertiary,
          color: token.colorTextSecondary,
          flex: "none",
        }}
        data-testid="drive-row-folder-glyph"
      >
        <FolderGlyph />
      </Flex>
    );
  }
  return <DriveThumbnail document={props.row.document} size={props.size} />;
}

/** The star control — an icon button, so it carries its own name. */
function StarButton(props: DriveRowViewProps): ReactElement {
  const t = useT();
  const starred = props.row.isStarred === true;
  return (
    <Button
      type="text"
      size="small"
      aria-label={t(starred ? DRIVE_I18N_KEYS.unstar : DRIVE_I18N_KEYS.star)}
      aria-pressed={starred}
      icon={<StarGlyph filled={starred} />}
      data-testid={`drive-star-${props.row.id}`}
      data-analytics="none"
      data-analytics-reason="the host app wraps row actions with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      onClick={(event) => {
        event.stopPropagation();
        props.onToggleStar(props.row, !starred);
      }}
    />
  );
}

function MoreButton(props: DriveRowViewProps): ReactElement {
  const t = useT();
  return (
    <Button
      type="text"
      size="small"
      aria-label={t(DRIVE_I18N_KEYS.actionsLabel)}
      icon={<MoreGlyph />}
      data-testid={`drive-actions-${props.row.id}`}
      data-analytics="none"
      data-analytics-reason="opens the action sheet — the action chosen inside it is the tracked one"
      onClick={(event) => {
        event.stopPropagation();
        props.onActions(props.row);
      }}
    />
  );
}

/** The row's second line: what it is, and (for a file) how big and how old. */
function useRowMeta(row: DriveRow): string {
  const t = useT();
  const { locale } = useI18n();
  if (row.kind === "folder") return t(DRIVE_I18N_KEYS.itemsFolder);
  return `${formatBytes(row.document.size_bytes, locale)} · ${formatDate(
    row.document.updated_at,
    locale
  )}`;
}

/** One row of the single-column list. */
export function DriveListRow(props: DriveRowViewProps): ReactElement {
  const meta = useRowMeta(props.row);
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`drive-row-${props.row.id}`}
      data-drive-row-kind={props.row.kind}
      data-analytics="none"
      data-analytics-reason="navigation within the surface — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      style={{ cursor: "pointer" }}
      onClick={() => {
        props.onOpen(props.row);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onOpen(props.row);
        }
      }}
    >
      <ListRow
        leading={<Leading row={props.row} size={ROW_THUMBNAIL} />}
        title={props.row.name}
        meta={meta}
        truncate
        trailing={
          <Flex gap={spacing[1]} align="center">
            <StarButton {...props} />
            <MoreButton {...props} />
          </Flex>
        }
      />
    </div>
  );
}

/** One tile of the grid. */
export function DriveGridTile(props: DriveRowViewProps): ReactElement {
  const { token } = antdTheme.useToken();
  return (
    <Flex
      vertical
      align="center"
      gap={spacing[1]}
      role="button"
      tabIndex={0}
      data-testid={`drive-tile-${props.row.id}`}
      data-drive-row-kind={props.row.kind}
      data-analytics="none"
      data-analytics-reason="navigation within the surface — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      style={{
        cursor: "pointer",
        padding: spacing[2],
        borderRadius: radii.md,
        background: token.colorBgContainer,
      }}
      onClick={() => {
        props.onOpen(props.row);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onOpen(props.row);
        }
      }}
    >
      <Leading row={props.row} size={TILE_THUMBNAIL} />
      <Typography.Text
        ellipsis
        style={{ fontSize: fontSize.sm.fontSize, textAlign: "center", width: "100%" }}
      >
        {props.row.name}
      </Typography.Text>
      <Flex gap={spacing[1]} align="center">
        <StarButton {...props} />
        <MoreButton {...props} />
      </Flex>
    </Flex>
  );
}
