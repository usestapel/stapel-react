/**
 * The three states a screen can be in besides "showing the thing", rendered
 * ONCE for the fleet: `ErrorAlert`, `EmptyState`, and the `LoadBoundary` /
 * `LoadList` that place them.
 *
 * `@stapel/core` made the states impossible to confuse at the TYPE level
 * (`LoadState`, `matchList` with four required arms). At the COMPONENT level
 * the fleet then hand-rolled the rendering fifteen times: fifteen
 * `src/default/ErrorAlert.tsx` files in six flavours, and `<Empty>`/`<Spin>`
 * placed per pair. The diff between two of them was prose plus an `action`
 * prop one had and the other did not. This module is the union of those
 * props, once, next to `SkinDialog` — the layer every antd skin already
 * depends on.
 *
 * Copy (retry, dismiss, the empty-state default, the loading label) comes
 * from core's UI floor (`STAPEL_UI_KEYS`) through the nearest
 * `<I18nProvider>` — translated in every locale the host runs, overridable by
 * registering the same key later — and from the English floor where there is
 * no provider at all (see `./floor.ts`).
 */
import { useId, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Alert, Empty, Skeleton, Space, Typography, theme as antdTheme } from "antd";
import { SkinButton as Button } from "./components.js";
import { STAPEL_UI_KEYS, matchList, matchLoad } from "@stapel/core";
import type { FlowErrorDisplay, LoadState, NonEmptyArray } from "@stapel/core";
import { useDialogSurface } from "./dialog.js";
import { useElementWidth } from "./elementWidth.js";
import { PANE_MEASURES } from "./pane.js";
import { useSubstrateI18n } from "./floor.js";

/**
 * The element width under which the block alert's actions stack under the
 * message instead of sitting in a column beside it. The `narrow` measure —
 * the width of a form column — because that is the point at which a message
 * and an action column stop fitting on one line together.
 */
export const ACTION_STACK_BELOW: number = PANE_MEASURES.narrow;

export interface ErrorAlertProps {
  /**
   * An error already described by core (`useErrorDisplay()` /
   * `useDescribeFlowError()`): the human sentence plus the technical detail.
   * The drop-in for the fifteen deleted copies, which took exactly this.
   */
  readonly error?: FlowErrorDisplay | undefined;
  /**
   * A raw thrown value (`mutation.error`, a `LoadFailed.error`). Folded
   * through core's `useErrorDisplay` here, so a skin holding an `unknown`
   * does not have to import the dialect to render it correctly.
   */
  readonly thrown?: unknown;
  /** A sentence the caller already has (translated). Wins over the two above. */
  readonly message?: string | undefined;
  /** Technical detail beside a caller-supplied `message`. */
  readonly detail?: string | undefined;
  /**
   * `"block"` (default): an antd `Alert`, the surface for a failed screen or
   * section. `"inline"`: one line of danger text with its actions, for a
   * form row or a toolbar where a boxed alert would push the layout.
   */
  readonly variant?: "block" | "inline";
  /** Re-run the failed read. Omit where there is nothing to re-run. */
  readonly onRetry?: (() => void) | undefined;
  /** Override the floor's "Try again". */
  readonly retryLabel?: string;
  /** Let the person close the alert. Omit for an error that must stay. */
  readonly onDismiss?: (() => void) | undefined;
  /** Override the floor's "Dismiss" (the close control's accessible name). */
  readonly dismissLabel?: string;
  /** Any further action beside the retry (a link to settings, a sign-in door). */
  readonly action?: ReactNode;
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/**
 * The one error surface. Renders nothing for nothing: `undefined`/`null` in
 * every source prop is "no error", so a skin hands it `mutation.error`
 * without a ternary.
 *
 * `message` at normal weight, `detail` muted and small (owner ruling
 * 2026-08-09: the status is a support handle, not part of the sentence);
 * the retry sits beside the bad news, because a failed read is usually one
 * button from succeeding.
 */
export function ErrorAlert(props: ErrorAlertProps): ReactElement | null {
  const { t, describe } = useSubstrateI18n();
  const { token } = antdTheme.useToken();
  const box = useRef<HTMLDivElement | null>(null);
  // antd puts `action` in a COLUMN beside the message. In a narrow box that
  // column takes the room the sentence needs: at 390px the visual pass
  // measured the message squeezed to ~110px, breaking a word per line, with
  // "Try again" beside it (VC-B6). The question is the BOX's width — the
  // shop's failed panel is equally narrow in a 380px side panel on a desktop
  // — so the actions move UNDER the message below the narrow measure.
  const { below } = useElementWidth(box, { thresholds: { stack: ACTION_STACK_BELOW } });
  const phone = useDialogSurface() === "sheet";
  const shown = resolveShown(props, describe);
  if (shown === undefined) return null;

  const retryLabel = props.retryLabel ?? t(STAPEL_UI_KEYS.retry);
  const dismissLabel = props.dismissLabel ?? t(STAPEL_UI_KEYS.dismiss);
  const variant = props.variant ?? "block";
  const detailNode =
    shown.detail !== undefined && shown.detail.length > 0 ? (
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {shown.detail}
      </Typography.Text>
    ) : null;

  if (variant === "inline") {
    return (
      <div
        role="alert"
        data-stapel-error="inline"
        {...(props.className !== undefined ? { className: props.className } : {})}
        {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          columnGap: token.paddingXS,
          rowGap: token.paddingXXS,
          color: token.colorError,
          ...props.style,
        }}
      >
        <span>{shown.message}</span>
        {detailNode}
        {props.onRetry !== undefined && (
          <Button
            type="link"
            size="small"
            onClick={props.onRetry}
            data-analytics="none"
            data-analytics-reason="retry of a failed read; the read hook reports its own outcome"
          >
            {retryLabel}
          </Button>
        )}
        {props.action}
        {props.onDismiss !== undefined && (
          <Button
            type="text"
            size="small"
            aria-label={dismissLabel}
            onClick={props.onDismiss}
            data-analytics="none"
            data-analytics-reason="local-ui-dismiss-alert"
          >
            {dismissLabel}
          </Button>
        )}
      </div>
    );
  }

  const actions =
    props.onRetry !== undefined || props.action !== undefined ? (
      <Space size="small">
        {props.onRetry !== undefined && (
          <Button
            size="small"
            onClick={props.onRetry}
            data-analytics="none"
            data-analytics-reason="retry of a failed read; the read hook reports its own outcome"
          >
            {retryLabel}
          </Button>
        )}
        {props.action}
      </Space>
    ) : undefined;

  // Unmeasured (first paint, a server render, no observer) is seeded from the
  // dialog-surface rule: on a phone the stacked arm is the one that fits.
  const stacked = actions !== undefined && (below.stack ?? phone);
  const description =
    stacked || detailNode !== null ? (
      <>
        {detailNode}
        {stacked && (
          <div style={{ marginTop: detailNode !== null ? token.paddingXS : 0 }}>{actions}</div>
        )}
      </>
    ) : null;

  return (
    <div
      ref={box}
      data-stapel-error-actions={stacked ? "stacked" : "inline"}
      style={{ minWidth: 0 }}
    >
    <Alert
      type="error"
      showIcon
      role="alert"
      data-stapel-error="block"
      title={shown.message}
      {...(description !== null ? { description } : {})}
      {...(actions !== undefined && !stacked ? { action: actions } : {})}
      {...(props.onDismiss !== undefined
        ? { closable: { closeIcon: true, "aria-label": dismissLabel }, onClose: props.onDismiss }
        : { closable: false })}
      {...(props.style !== undefined ? { style: props.style } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    />
    </div>
  );
}

function resolveShown(
  props: ErrorAlertProps,
  describe: (error: unknown) => FlowErrorDisplay
): FlowErrorDisplay | undefined {
  if (props.message !== undefined) {
    return { message: props.message, detail: props.detail };
  }
  if (props.error !== undefined) return props.error;
  if (props.thrown !== undefined && props.thrown !== null) return describe(props.thrown);
  return undefined;
}

export interface EmptyStateProps {
  /** A pictogram above the title. Default: antd's simple empty image. */
  readonly icon?: ReactNode;
  /** Default: the floor's "Nothing here yet". Pass the pair's own sentence —
   * "no drafts yet" tells more than "nothing". */
  readonly title?: ReactNode;
  /** What the person can do about it, in a sentence. */
  readonly hint?: ReactNode;
  /** The door: a primary button, a link to create the first thing. */
  readonly action?: ReactNode;
  /** Tighter padding — inside a card or a table body. */
  readonly compact?: boolean;
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/**
 * The designed empty state. Reachable ONLY from a load that succeeded and
 * had nothing (`LoadList` routes it so); rendering it for a failed load is
 * the lie `LoadState` exists to end.
 */
export function EmptyState(props: EmptyStateProps): ReactElement {
  const { t } = useSubstrateI18n();
  const { token } = antdTheme.useToken();
  const titleId = useId();
  return (
    <div
      role="status"
      aria-labelledby={titleId}
      data-stapel-empty=""
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: token.paddingXS,
        padding: props.compact === true ? token.padding : token.paddingXL,
        color: token.colorTextSecondary,
        ...props.style,
      }}
    >
      <div aria-hidden="true">{props.icon ?? Empty.PRESENTED_IMAGE_SIMPLE}</div>
      <Typography.Text id={titleId} strong style={{ color: token.colorText }}>
        {props.title ?? t(STAPEL_UI_KEYS.emptyTitle)}
      </Typography.Text>
      {props.hint !== undefined && <Typography.Text type="secondary">{props.hint}</Typography.Text>}
      {props.action !== undefined && <div style={{ marginTop: token.paddingXS }}>{props.action}</div>}
    </div>
  );
}

interface LoadArmsProps {
  /** The loading arm. Default: an active `Skeleton` in a labelled busy region. */
  readonly loading?: ReactNode;
  /** Skeleton paragraph rows for the default loading arm. */
  readonly skeletonRows?: number;
  /** The failed arm. Default: {@link ErrorAlert} with the thrown value and
   * `onRetry`. */
  readonly failed?: (error: unknown) => ReactNode;
  /** Re-run the load; wired to the default failed arm's retry. */
  readonly onRetry?: (() => void) | undefined;
  readonly testId?: string | undefined;
}

export interface LoadBoundaryProps<T> extends LoadArmsProps {
  readonly state: LoadState<T>;
  /** The ready arm — receives the data, which exists ONLY here. */
  readonly children: (data: T) => ReactNode;
}

/**
 * `matchLoad` as a component: the loading and failed arms are designed once
 * and the skin writes only the ready arm.
 *
 * ```tsx
 * <LoadBoundary state={bag.state} onRetry={bag.refetch}>
 *   {(profile) => <ProfileCard profile={profile} />}
 * </LoadBoundary>
 * ```
 *
 * The arms are stamped `data-stapel-load-state="loading|failed"`; the ready
 * arm renders the children without a wrapper, so it costs the layout nothing.
 */
export function LoadBoundary<T>(props: LoadBoundaryProps<T>): ReactElement {
  return (
    <>
      {matchLoad<T, ReactNode>(props.state, {
        loading: () => <LoadingArm {...props} />,
        failed: (error) => <FailedArm {...props} error={error} />,
        ready: props.children,
      })}
    </>
  );
}

export interface LoadListProps<T> extends LoadArmsProps {
  readonly state: LoadState<readonly T[]>;
  /** The ready arm — receives a non-empty array, so `items[0]` is a value. */
  readonly children: (items: NonEmptyArray<T>) => ReactNode;
  /** The empty arm. Default: {@link EmptyState} with the floor's title. Pass
   * the pair's own `<EmptyState title=… action=…/>`. */
  readonly empty?: ReactNode;
}

/**
 * `matchList` as a component — four arms, "empty" reachable only from a
 * load that succeeded.
 *
 * ```tsx
 * <LoadList state={bag.state} onRetry={bag.refetch}
 *   empty={<EmptyState title={t(KEYS.noDrafts)} action={<Button>…</Button>} />}>
 *   {(drafts) => drafts.map((d) => <DraftRow key={d.id} draft={d} />)}
 * </LoadList>
 * ```
 */
export function LoadList<T>(props: LoadListProps<T>): ReactElement {
  return (
    <>
      {matchList<T, ReactNode>(props.state, {
        loading: () => <LoadingArm {...props} />,
        failed: (error) => <FailedArm {...props} error={error} />,
        empty: () => (
          <div data-stapel-load-state="empty">
            {props.empty ?? <EmptyState {...(props.testId !== undefined ? { testId: `${props.testId}-empty` } : {})} />}
          </div>
        ),
        ready: props.children,
      })}
    </>
  );
}

function LoadingArm(props: LoadArmsProps): ReactElement {
  const { t } = useSubstrateI18n();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t(STAPEL_UI_KEYS.loading)}
      data-stapel-load-state="loading"
      {...(props.testId !== undefined ? { "data-testid": `${props.testId}-loading` } : {})}
    >
      {props.loading ?? (
        <Skeleton active paragraph={{ rows: props.skeletonRows ?? 3 }} />
      )}
    </div>
  );
}

function FailedArm(props: LoadArmsProps & { readonly error: unknown }): ReactElement {
  return (
    <div data-stapel-load-state="failed">
      {props.failed !== undefined ? (
        props.failed(props.error)
      ) : (
        <ErrorAlert
          thrown={props.error}
          onRetry={props.onRetry}
          {...(props.testId !== undefined ? { testId: `${props.testId}-failed` } : {})}
        />
      )}
    </div>
  );
}
