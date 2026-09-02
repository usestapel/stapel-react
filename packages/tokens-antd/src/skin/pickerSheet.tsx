/**
 * `SkinPickerSheet` — how a LONG list is picked from.
 *
 * ## The rule it states once
 *
 * **On a phone a long list is picked in a bottom sheet with a search box,
 * never in a dropdown.** An antd `Select` panel on a 390px screen is a
 * 250px-tall portal floating over the field it belongs to, with the
 * on-screen keyboard covering half of it the moment the person types; the
 * sheet takes the screen it needs, keeps its search box pinned at the top and
 * its commit button above the home indicator, and scrolls its own body
 * instead of the page. The catalogue this substrate serves has 2132 fields
 * whose answer comes from a reference vocabulary — one of them over 800k
 * terms — so "the list is long" is the normal case, not the exception.
 *
 * ## Why it lives in `@stapel/tokens-antd/skin`
 *
 * It COMPOSES {@link SkinDialog}: sheet on a phone, centred modal on
 * tablet/desktop, with the swipe, the focus trap, the safe-area padding and
 * the portal theming already solved there. That makes it antd-surface-bound
 * by construction — it cannot live in `@stapel/core`, which is deliberately
 * design-system-agnostic and carries no antd — and it must not live in a
 * pair, because the next pair to need a picker would re-derive the search
 * box, the sticky footer, the row cap and the stale-list rule with its own
 * set of near-misses. That is the history `SkinDialog` itself was written
 * against.
 *
 * ## The four states a picker has that a `Select` never modelled
 *
 *  - **`loading`** — the answer is being fetched. The list area shows a
 *    skeleton; the COMMIT is not blocked, because the values already chosen
 *    are still chosen and a person who is done should not have to wait for a
 *    list they are not reading.
 *  - **`listStale`** — the list on screen is NOT the answer to what is in the
 *    search box (the caller's own `matched === false`: a superseded request,
 *    a debounce still pending). The rows dim and stop responding, so nobody
 *    picks the previous query's fourth row believing it is this query's. Two
 *    pairs had improvised a version of this; it is a first-class prop here so
 *    the third one inherits it instead of re-inventing it.
 *  - **empty** — the load SUCCEEDED and had nothing, which is a different
 *    sentence from "still loading" and from "the search box holds nonsense".
 *  - **capped** — more rows matched than a phone can usefully scroll. At most
 *    {@link DEFAULT_MAX_ROWS} are drawn and the tail row says so; nothing is
 *    virtualized yet, and pretending a 5000-row list is scrollable would be
 *    the more expensive lie.
 *
 * ## Multi-select commits; single-select answers
 *
 * A single choice closes the sheet on the tap that makes it — that is the
 * whole interaction, and asking for a second confirming tap on a phone is the
 * kind of politeness nobody thanked us for. A MULTI sheet holds a draft and
 * commits it on the footer button, so the person can uncheck the thing they
 * mis-tapped without the list re-sorting under them, and the count on the
 * button is what they are about to keep. Dismissing (swipe, Esc, mask, ✕)
 * discards the draft — which is why the button carries the count: it is the
 * difference between the two exits, in numerals.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Input, Skeleton, Typography, theme as antdTheme } from "antd";
import { STAPEL_UI_KEYS } from "@stapel/core";
import { SkinDialog } from "./dialog.js";
import type { DialogSurface } from "./dialogSurface.js";
import { useDialogSurface } from "./dialogSurface.js";
import { EmptyState } from "./states.js";
import { useSubstrateI18n } from "./floor.js";
import { PHONE_CONTROL_HEIGHT } from "./theme.js";

/** How many rows are drawn before the tail row takes over. */
export const DEFAULT_MAX_ROWS: number = 200;

/** How close to the bottom (px) counts as "the end is on screen". */
const END_REACHED_SLACK = 120;

/** The picker's search box, for a caller's test and for a shot runner. */
export const PICKER_SEARCH_TESTID: string = "stapel-picker-search";
/** The multi-select commit button. */
export const PICKER_DONE_TESTID: string = "stapel-picker-done";

/** The glyph a chosen row carries. Decorative — the state is in `aria-checked`. */
const CHECK_GLYPH = "✓";

export interface PickerOption {
  /** The code the caller stores. */
  readonly value: string;
  /** What the person reads, and what the LOCAL filter matches on. */
  readonly label: string;
  /** A second line — a disambiguator ("Munich, Germany"), never the label. */
  readonly description?: string;
  readonly disabled?: boolean;
}

export interface PickerGroup {
  readonly key: string;
  /** The group's heading ("Recent"). Copy the CALLER owns. */
  readonly label: ReactNode;
  readonly options: readonly PickerOption[];
}

interface PickerSheetBase {
  readonly open: boolean;
  /** Dismissal — ✕, mask, Esc, swipe. A multi draft is discarded. */
  readonly onClose: () => void;
  readonly title?: ReactNode;
  /** The dialog's accessible name when there is no `title`. */
  readonly ariaLabel?: string;
  /**
   * Accessible name of the sheet's grab handle / the modal's close control.
   * Defaults to the UI floor's "Dismiss" in the host's locale.
   */
  readonly dismissLabel?: string;
  /** The flat list. Ignored when {@link PickerSheetBase.groups} is given. */
  readonly options?: readonly PickerOption[];
  /**
   * The list in sections — how a caller puts "Recent" on top (see
   * `useRecents` in `@stapel/core`). A group with no options is not drawn, so
   * an empty recents list costs nothing and needs no conditional at the call
   * site.
   */
  readonly groups?: readonly PickerGroup[];
  /** Default `true`. `false` for a list short enough that a box is noise. */
  readonly searchable?: boolean;
  /** Controlled search text. With `onSearchChange`, the CALLER owns filtering. */
  readonly searchValue?: string;
  /**
   * Present = the caller answers the query (an async vocabulary search) and
   * the sheet renders exactly what it is given. Absent = the sheet filters
   * the options it holds, locally and case-insensitively, on `label`.
   */
  readonly onSearchChange?: (value: string) => void;
  /** Placeholder AND accessible name of the search box. Copy the caller owns. */
  readonly searchPlaceholder?: string;
  /** The accessible name, when it should differ from the placeholder. */
  readonly searchLabel?: string;
  /** The answer is in flight: a skeleton in the list area. Never blocks commit. */
  readonly loading?: boolean;
  /**
   * The rows on screen do not answer what is in the box (the caller's
   * `matched === false`). They dim and stop responding until they do.
   */
  readonly listStale?: boolean;
  /** Title of the empty arm. Defaults to the floor's "Nothing here yet". */
  readonly emptyLabel?: string;
  /** The tail row's sentence when the list was capped. Omit to draw no tail. */
  readonly refineLabel?: string;
  /**
   * The person scrolled (near) the end of the list — the sheet's half of
   * paging through a server-paged vocabulary. The CALLER owns the fetch, the
   * de-duplication and knowing when the level is exhausted; the sheet only
   * says "the end is on screen", and says it again on every further scroll,
   * so an idempotent caller is the contract. Fires from whichever ancestor
   * actually scrolls (the dialog body), which is why it listens in capture
   * on `window` rather than on the list itself.
   */
  readonly onEndReached?: () => void;
  /** Default {@link DEFAULT_MAX_ROWS}. */
  readonly maxRows?: number;
  /** Force a surface (tests). See `SkinDialogProps.surface`. */
  readonly surface?: DialogSurface;
  readonly style?: CSSProperties;
  readonly className?: string;
  readonly testId?: string;
}

export interface PickerSheetSingleProps extends PickerSheetBase {
  readonly mode: "single";
  readonly value?: string | undefined;
  /** Called with the tapped code; the sheet then closes itself. */
  readonly onChange: (value: string) => void;
}

export interface PickerSheetMultiProps extends PickerSheetBase {
  readonly mode: "multi";
  readonly values: readonly string[];
  /** Called ONCE, with the committed draft, when the footer button is pressed. */
  readonly onChange: (values: readonly string[]) => void;
  /**
   * The commit button's copy — REQUIRED, because it is the one sentence in
   * this component a person must read and the bridge owns no i18n. The
   * selected count is appended to it (see
   * {@link PickerSheetMultiProps.formatDoneLabel}).
   */
  readonly doneLabel: string;
  /**
   * Override how the count joins the label. The default appends `" · N"` and
   * — deliberately — appends NOTHING at zero: "Done · 0" reads as a broken
   * counter, while "Done" over an empty draft is exactly what pressing it
   * does (it clears the answer).
   */
  readonly formatDoneLabel?: (label: string, count: number) => string;
}

export type SkinPickerSheetProps = PickerSheetSingleProps | PickerSheetMultiProps;

function defaultDoneLabel(label: string, count: number): string {
  return count > 0 ? `${label} · ${String(count)}` : label;
}

/** The groups a render pass actually draws: flat options become one group. */
function resolveGroups(props: SkinPickerSheetProps): readonly PickerGroup[] {
  if (props.groups !== undefined) return props.groups;
  return [{ key: "", label: undefined, options: props.options ?? [] }];
}

function matches(option: PickerOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  if (option.label.toLowerCase().includes(needle)) return true;
  return option.description !== undefined && option.description.toLowerCase().includes(needle);
}

/**
 * The picker surface. Stamped `data-stapel-picker="single|multi"`,
 * `data-stapel-picker-list="fresh|stale"` and — through {@link SkinDialog} —
 * `data-stapel-dialog-surface`, so a pair's test proves the shape it
 * inherited instead of asserting it in prose.
 *
 * ```tsx
 * <SkinPickerSheet
 *   mode="multi"
 *   open={open}
 *   onClose={close}
 *   title={t(KEYS.bodyType)}
 *   doneLabel={t(KEYS.done)}
 *   searchPlaceholder={t(KEYS.search)}
 *   groups={[{ key: "recent", label: t(KEYS.recent), options: recentOptions }, …]}
 *   values={chosen}
 *   onChange={setChosen}
 * />
 * ```
 */
export function SkinPickerSheet(props: SkinPickerSheetProps): ReactElement {
  const { t } = useSubstrateI18n();
  const { token } = antdTheme.useToken();
  const auto = useDialogSurface();
  const surface = props.surface ?? auto;
  const phone = surface === "sheet";
  const stale = props.listStale === true;
  const loading = props.loading === true;
  const controlledSearch = props.onSearchChange !== undefined;
  const [localQuery, setLocalQuery] = useState("");
  const multiValues = props.mode === "multi" ? props.values : undefined;
  const [draft, setDraft] = useState<readonly string[]>(multiValues ?? []);

  // A sheet is a transaction: it opens holding what the field holds, not what
  // the last visit left in it. `destroyOnHidden` unmounts the BODY, but this
  // component outlives it, so the seed happens here — ONCE per opening. A
  // caller that rebuilds its `values` array every render (most of them) would
  // otherwise re-seed the draft on every keystroke, and every checkbox the
  // person ticked would spring back.
  const seeded = useRef(false);
  useEffect(() => {
    if (props.open && !seeded.current) {
      seeded.current = true;
      setDraft(multiValues ?? []);
      return;
    }
    if (!props.open && seeded.current) {
      seeded.current = false;
      setLocalQuery("");
    }
  }, [props.open, multiValues]);

  const query = controlledSearch ? (props.searchValue ?? "") : localQuery;
  const maxRows = props.maxRows ?? DEFAULT_MAX_ROWS;

  const groups = resolveGroups(props);
  // Controlled search means the CALLER's list is already the answer; filtering
  // it again here would hide rows a server matched on a field we cannot see.
  const filtered = useMemo<readonly PickerGroup[]>(() => {
    if (controlledSearch || query.trim().length === 0) return groups;
    return groups.map((group) => ({
      ...group,
      options: group.options.filter((option) => matches(option, query)),
    }));
  }, [controlledSearch, query, groups]);

  let remaining = maxRows;
  const drawn: PickerGroup[] = [];
  for (const group of filtered) {
    if (group.options.length === 0) continue;
    if (remaining <= 0) break;
    const slice = group.options.slice(0, remaining);
    remaining -= slice.length;
    drawn.push({ ...group, options: slice });
  }
  const total = filtered.reduce((sum, group) => sum + group.options.length, 0);
  const capped = total > maxRows;
  const nothing = total === 0;

  const chosen = (value: string): boolean =>
    props.mode === "single" ? props.value === value : draft.includes(value);

  const pick = (option: PickerOption): void => {
    if (stale || option.disabled === true) return;
    if (props.mode === "single") {
      props.onChange(option.value);
      props.onClose();
      return;
    }
    setDraft((current) =>
      current.includes(option.value)
        ? current.filter((entry) => entry !== option.value)
        : [...current, option.value]
    );
  };

  const rowStyle = (selected: boolean, disabled: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: token.paddingXS,
    width: "100%",
    minHeight: phone ? PHONE_CONTROL_HEIGHT : token.controlHeight,
    padding: `${String(token.paddingXS)}px ${String(token.paddingSM)}px`,
    border: "none",
    borderRadius: token.borderRadius,
    textAlign: "left",
    background: selected ? token.controlItemBgActive : "transparent",
    color: disabled ? token.colorTextDisabled : token.colorText,
    cursor: disabled ? "not-allowed" : "pointer",
    font: "inherit",
    fontSize: token.fontSize,
  });

  const endAnchor = useRef<HTMLDivElement | null>(null);
  const onEndReached = props.onEndReached;
  const sheetOpen = props.open;
  useEffect(() => {
    if (onEndReached === undefined || !sheetOpen) return undefined;
    const handler = (event: Event): void => {
      const anchor = endAnchor.current;
      if (anchor === null) return;
      const target = event.target;
      const scroller =
        target instanceof Element
          ? target
          : target === document
            ? document.documentElement
            : null;
      if (scroller === null || !scroller.contains(anchor)) return;
      if (
        scroller.scrollTop + scroller.clientHeight >=
        scroller.scrollHeight - END_REACHED_SLACK
      ) {
        onEndReached();
      }
    };
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("scroll", handler, true);
    };
  }, [onEndReached, sheetOpen]);

  const list = (
    <div
      ref={endAnchor}
      data-stapel-picker-list={stale ? "stale" : "fresh"}
      {...(stale ? { "aria-busy": "true" } : {})}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: token.paddingXXS,
        // The stale list is dimmed AND inert: a row that answers the previous
        // query must not be pickable while it is being contradicted.
        ...(stale ? { opacity: 0.45, pointerEvents: "none" as const } : {}),
      }}
    >
      {drawn.map((group) => (
        <div key={group.key} role={props.mode === "single" ? "radiogroup" : "group"}>
          {group.label !== undefined && (
            <Typography.Text
              type="secondary"
              style={{
                display: "block",
                fontSize: token.fontSizeSM,
                padding: `${String(token.paddingXS)}px ${String(token.paddingSM)}px 0`,
              }}
            >
              {group.label}
            </Typography.Text>
          )}
          {group.options.map((option) => {
            const selected = chosen(option.value);
            const disabled = option.disabled === true || stale;
            return (
              <button
                key={option.value}
                type="button"
                role={props.mode === "single" ? "radio" : "checkbox"}
                aria-checked={selected}
                disabled={disabled}
                data-stapel-picker-row={option.value}
                data-analytics="none"
                data-analytics-reason="passthrough — the caller's onChange carries the tracked pick"
                onClick={() => {
                  pick(option);
                }}
                style={rowStyle(selected, disabled)}
              >
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span>{option.label}</span>
                  {option.description !== undefined && (
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {option.description}
                    </Typography.Text>
                  )}
                </span>
                <span aria-hidden="true" style={{ color: token.colorPrimary }}>
                  {selected ? CHECK_GLYPH : ""}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      {capped && props.refineLabel !== undefined && (
        <Typography.Text
          type="secondary"
          data-stapel-picker-tail=""
          style={{
            fontSize: token.fontSizeSM,
            padding: `${String(token.paddingXS)}px ${String(token.paddingSM)}px`,
          }}
        >
          {props.refineLabel}
        </Typography.Text>
      )}
    </div>
  );

  const body = loading ? (
    <div
      role="status"
      aria-busy="true"
      aria-label={t(STAPEL_UI_KEYS.loading)}
      data-stapel-picker-loading=""
    >
      <Skeleton active paragraph={{ rows: 4 }} />
    </div>
  ) : nothing ? (
    <EmptyState
      compact
      {...(props.emptyLabel !== undefined ? { title: props.emptyLabel } : {})}
    />
  ) : (
    list
  );

  const searchName = props.searchLabel ?? props.searchPlaceholder;
  const search = props.searchable === false ? null : (
    <Input
      value={query}
      allowClear
      data-testid={PICKER_SEARCH_TESTID}
      {...(searchName !== undefined ? { "aria-label": searchName } : {})}
      {...(props.searchPlaceholder !== undefined
        ? { placeholder: props.searchPlaceholder }
        : {})}
      onChange={(event) => {
        const next = event.target.value;
        if (props.onSearchChange !== undefined) props.onSearchChange(next);
        else setLocalQuery(next);
      }}
      style={{ marginBottom: token.paddingSM }}
    />
  );

  const footer =
    props.mode === "multi" ? (
      <Button
        type="primary"
        block={phone}
        data-testid={PICKER_DONE_TESTID}
        data-analytics="none"
        data-analytics-reason="passthrough — the caller's onChange carries the tracked commit"
        onClick={() => {
          props.onChange(draft);
          props.onClose();
        }}
      >
        {(props.formatDoneLabel ?? defaultDoneLabel)(props.doneLabel, draft.length)}
      </Button>
    ) : undefined;

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      dismissLabel={props.dismissLabel ?? t(STAPEL_UI_KEYS.dismiss)}
      surface={surface}
      {...(props.title !== undefined ? { title: props.title } : {})}
      {...(props.ariaLabel !== undefined ? { ariaLabel: props.ariaLabel } : {})}
      {...(footer !== undefined ? { footer } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    >
      <div data-stapel-picker={props.mode} style={props.style}>
        {search}
        {body}
      </div>
    </SkinDialog>
  );
}
