/**
 * `<RowActions>` — the per-row overflow control, once for the three panes
 * that have one.
 *
 * ── What it replaces ──────────────────────────────────────────────────────
 *
 * Every row in the document list, the trash and the folder tree used to end
 * in a text LINK reading "Actions" — a control named after its own category,
 * repeated three times on one screen, with no icon and no affordance, and
 * (as a `Typography.Link`) a touch target well under 44px. On desktop the
 * link was pinned to the far edge of a full-bleed list, leaving ~1400px of
 * dead gap between a file's name and the only thing you could do to it.
 *
 * So: an icon BUTTON carrying the ⋯ glyph every file manager uses, with the
 * category name moved to `aria-label` where it belongs, sized to the antd
 * control height (44px on a phone, via `SkinTheme`), and placed by the
 * caller beside the row content rather than against the viewport edge.
 *
 * The glyph is inline SVG rather than an icon-font dependency: the pair
 * carries no `@ant-design/icons`, and three dots do not justify one.
 */
import type { ReactElement } from "react";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";

export interface RowActionsProps {
  /** The same menu the row's right-click opens. */
  readonly menu: MenuProps;
  /** Accessible name — the caller's i18n copy ("Actions"). */
  readonly label: string;
  /** Marks the trigger for a test / a host stylesheet. */
  readonly dataAttribute?: Readonly<Record<string, string>>;
  /** Selecting the row and opening its menu are two different things. */
  readonly stopPropagation?: boolean;
}

/** Three dots, drawn in `currentColor` so the button's own token colours it. */
function OverflowGlyph(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}

export function RowActions(props: RowActionsProps): ReactElement {
  return (
    <Dropdown trigger={["click"]} menu={props.menu}>
      <Button
        type="text"
        aria-label={props.label}
        icon={<OverflowGlyph />}
        {...(props.dataAttribute ?? {})}
        {...(props.stopPropagation === true
          ? {
              onClick: (event: { stopPropagation: () => void }) => {
                event.stopPropagation();
              },
            }
          : {})}
        data-analytics="none"
        data-analytics-reason="opens a menu — the chosen item carries the tracked action"
      />
    </Dropdown>
  );
}
