/**
 * `StatusTag` — one treatment per status FAMILY, for the whole fleet.
 *
 * The visual pass found four chip treatments for one moderation status
 * (reviews), two palettes for one listing state (listings), `Required` drawn
 * in the danger token (categories), green for "Payment overdue" and
 * info-blue for "expired" (billing) — every pair choosing a colour for a
 * word instead of naming the family the word belongs to. A status is one of
 * five things: it went well, it needs attention, it failed, it is
 * information, or it is nothing in particular. The family picks the colour;
 * the colour comes from the theme's status roles (`toAntdTheme` maps
 * `success-bg` / `warning-bg` / … from the token JSON), so it is right in
 * both modes and a hex here would be a regression.
 *
 * Not interactive: a tag that does something is a button. The phone touch
 * floor targets `.ant-tag-checkable` and `role="button"` tags only, so a
 * status chip keeps its chip height.
 */
import type { ReactElement, ReactNode } from "react";
import { Tag } from "antd";

/** The five families a status can belong to. */
export type StatusFamily = "success" | "warning" | "error" | "info" | "neutral";

export interface StatusTagProps {
  readonly status: StatusFamily;
  /** The word — translated by the caller. */
  readonly children: ReactNode;
  /** A leading glyph. Decorative: the word carries the meaning. */
  readonly icon?: ReactNode;
  /** `true` (default) draws the family's border; `false` is the filled chip
   * for a dense row. Both read the same roles. */
  readonly bordered?: boolean;
  readonly className?: string;
  readonly testId?: string | undefined;
}

const ANTD_COLOR: Readonly<Record<StatusFamily, string>> = {
  success: "success",
  warning: "warning",
  error: "error",
  info: "processing",
  neutral: "default",
};

/** Stamped `data-stapel-status="<family>"` so a test can assert the family
 * a state was filed under without reading a colour. */
export function StatusTag(props: StatusTagProps): ReactElement {
  return (
    <Tag
      color={ANTD_COLOR[props.status]}
      data-stapel-status={props.status}
      {...(props.icon !== undefined ? { icon: props.icon } : {})}
      {...(props.bordered === false ? { variant: "filled" as const } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{ marginInlineEnd: 0, whiteSpace: "nowrap" }}
    >
      {props.children}
    </Tag>
  );
}
