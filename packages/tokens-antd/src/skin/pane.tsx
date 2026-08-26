/**
 * `Pane` / `Page` — the measure and the padding scale, stated once.
 *
 * Seventy-three files hand-set `maxWidth` (visual pass C-NOMAXW), which
 * means seventy-three answers to "how wide is a column of this kind": a
 * detail page at 24rem in one package, a settings table stretched to 2530px
 * in another, a chip 2300px from its label in a third. A measure is a
 * design-system decision — a reading column, a form column, a page — and it
 * belongs beside the colours and the control heights, not in each pair.
 *
 * `Pane` is the box: a named measure, centred, with the padding scale for
 * its width. `Page` is a screen: a `Pane` on the layout surface with the one
 * title/actions header a page has. Neither decides its layout from the
 * viewport — a pane inside a 390px column on a desktop is the same pane —
 * except for the padding step, which follows the same phone rule as the
 * control height (`useDialogSurface`), because gutters are about thumbs.
 */
import type { CSSProperties, ElementType, ReactElement, ReactNode } from "react";
import { Typography, theme as antdTheme } from "antd";
import { breakpoints } from "@stapel/tokens";
import { useDialogSurface } from "./dialog.js";
import { SkinTheme } from "./theme.js";
import type { SkinThemeProps } from "./theme.js";
import { CardHeader } from "./listRow.js";

/**
 * The measures. `narrow` is a form or a sign-in card; `reading` a column of
 * prose or a detail; `wide` a two-pane screen or a table, capped at the
 * desktop breakpoint; `full` no cap (a map, a canvas).
 */
export type PaneMeasure = "narrow" | "reading" | "wide" | "full";

/** The measure scale in CSS px, derived from the token breakpoints so a
 * `wide` pane and the desktop breakpoint can never disagree. */
export const PANE_MEASURES: Readonly<Record<Exclude<PaneMeasure, "full">, number>> = {
  narrow: breakpoints.tablet - breakpoints.tablet / 4,
  reading: breakpoints.tablet,
  wide: breakpoints.desktop,
};

/** The padding step. `regular` is a page or a card section; `compact` a
 * list body or a sheet; `roomy` a landing block; `none` a pane that only
 * measures. */
export type PanePadding = "none" | "compact" | "regular" | "roomy";

export interface PaneProps {
  /** Default `"reading"`. */
  readonly measure?: PaneMeasure;
  /** Default `"regular"`. Horizontal only unless `padBlock`. */
  readonly padding?: PanePadding;
  /** Also pad top and bottom. Default `false` — vertical rhythm is the
   * page's, not each section's. */
  readonly padBlock?: boolean;
  /** `"center"` (default) centres the measure in a wider parent; `"start"`
   * hugs the leading edge (a pane beside a rail). */
  readonly align?: "center" | "start";
  /** The element. Default `"div"`; a page passes `"main"`, a section `"section"`. */
  readonly as?: ElementType;
  readonly children: ReactNode;
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
  readonly "aria-labelledby"?: string;
  readonly "aria-label"?: string;
}

/** The padding for a step, on a phone or not, from the antd token layer. */
function usePanePadding(step: PanePadding): number {
  const { token } = antdTheme.useToken();
  const phone = useDialogSurface() === "sheet";
  switch (step) {
    case "none":
      return 0;
    case "compact":
      return phone ? token.paddingSM : token.padding;
    case "roomy":
      return phone ? token.paddingLG : token.paddingXL;
    default:
      return phone ? token.padding : token.paddingLG;
  }
}

/**
 * A measured, padded box. Stamped `data-stapel-pane="<measure>"`.
 *
 * ```tsx
 * <Pane measure="narrow" as="section" aria-labelledby={titleId}>…</Pane>
 * ```
 */
export function Pane(props: PaneProps): ReactElement {
  const measure = props.measure ?? "reading";
  const padding = usePanePadding(props.padding ?? "regular");
  const Element: ElementType = props.as ?? "div";
  const style: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    ...(measure === "full" ? {} : { maxWidth: PANE_MEASURES[measure] }),
    marginInline: props.align === "start" ? 0 : "auto",
    paddingInline: padding,
    ...(props.padBlock === true ? { paddingBlock: padding } : {}),
    ...props.style,
  };
  return (
    <Element
      data-stapel-pane={measure}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      {...(props["aria-labelledby"] !== undefined ? { "aria-labelledby": props["aria-labelledby"] } : {})}
      {...(props["aria-label"] !== undefined ? { "aria-label": props["aria-label"] } : {})}
      style={style}
    >
      {props.children}
    </Element>
  );
}

export interface PageProps extends Pick<SkinThemeProps, "mode" | "className" | "data-testid"> {
  /** The page's one heading. */
  readonly title?: ReactNode;
  /** A sentence under the title — what this screen is for. */
  readonly intro?: ReactNode;
  /** The page-level actions, beside the title; they wrap under it on a phone. */
  readonly actions?: ReactNode;
  /** Default `"wide"`. */
  readonly measure?: PaneMeasure;
  /** Default `"regular"`. */
  readonly padding?: PanePadding;
  readonly children: ReactNode;
  readonly style?: CSSProperties | undefined;
}

/**
 * A screen: the layout surface, a `main` pane at the page measure, the
 * title/actions header, and the page's own vertical rhythm. Self-theming
 * through `SkinTheme` (`surface="base"`), so a host mounts it bare.
 *
 * ```tsx
 * <Page title={t(KEYS.title)} actions={<Button type="primary">{t(KEYS.create)}</Button>}>
 *   <Pane measure="reading">…</Pane>
 * </Page>
 * ```
 */
export function Page(props: PageProps): ReactElement {
  const { token } = antdTheme.useToken();
  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      style={{ minHeight: "100%", ...props.style }}
    >
      <Pane
        as="main"
        measure={props.measure ?? "wide"}
        padding={props.padding ?? "regular"}
        padBlock
        style={{ display: "flex", flexDirection: "column", gap: token.paddingLG }}
      >
        {(props.title !== undefined || props.actions !== undefined) && (
          <CardHeader
            level={1}
            title={props.title ?? ""}
            {...(props.intro !== undefined ? { subtitle: props.intro } : {})}
            {...(props.actions !== undefined ? { actions: props.actions } : {})}
          />
        )}
        {props.intro !== undefined && props.title === undefined && props.actions === undefined && (
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {props.intro}
          </Typography.Paragraph>
        )}
        {props.children}
      </Pane>
    </SkinTheme>
  );
}
