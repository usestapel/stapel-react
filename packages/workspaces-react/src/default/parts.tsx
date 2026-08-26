/**
 * The small pieces every screen in this pair's default skin is built from.
 *
 * Not exported from `./index.ts`: these are the skin's own vocabulary, not
 * product surfaces a host mounts. They live in one file because the visual
 * pass found the same three things drawn differently on each screen — a
 * person rendered as a bare email here and a truncated id there, a page walk
 * with no way back, a muted caption at three different sizes.
 *
 * Every dimension is a `@stapel/tokens` step. Colour comes from antd's token
 * layer through `SkinTheme`, never from a literal.
 */
import { useId } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Avatar, Button, Flex, Tag, Typography } from "antd";
import { STAPEL_UI_KEYS, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { ErrorAlert } from "@stapel/tokens-antd/skin";
import { spacing, fontSize } from "@stapel/tokens";

/** The muted sentence that sits under a control or beside a value. */
export function Muted(props: {
  readonly children: ReactNode;
  readonly testId?: string | undefined;
}): ReactElement {
  return (
    <Typography.Text
      type="secondary"
      style={{ fontSize: fontSize.xs.fontSize }}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    >
      {props.children}
    </Typography.Text>
  );
}

/** One letter for a person with no picture. Never an id: the monogram of a
 * name, or of the mailbox part of an address, and a neutral glyph when there
 * is neither. */
function monogram(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "").trim();
  const first = source.charAt(0);
  return first === "" ? "·" : first.toUpperCase();
}

/**
 * A person, drawn the same way on every screen of this pair: monogram, the
 * name they go by, the address underneath.
 *
 * The rule the visual pass forced: an id never reaches the glass. A member
 * whose profile has no name shows the invited ADDRESS as the primary line and
 * says so, rather than showing a truncated UUID or an em dash.
 */
export function PersonLine(props: {
  readonly name: string | null | undefined;
  readonly email: string | null | undefined;
  /** Rendered under the address — "Joined 3 days ago", a suspension reason. */
  readonly caption?: ReactNode;
  /** Tags beside the name (suspended, provisioned, two-factor). */
  readonly tags?: ReactNode;
  readonly testId?: string | undefined;
}): ReactElement {
  const name = props.name?.trim() ? props.name.trim() : null;
  const email = props.email?.trim() ? props.email.trim() : null;
  const primary = name ?? email;
  return (
    <Flex
      gap={spacing["3"]}
      align="flex-start"
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    >
      <Avatar size="small" aria-hidden>
        {monogram(name, email)}
      </Avatar>
      <Flex vertical gap={spacing["0"]} style={{ minWidth: 0 }}>
        <Flex gap={spacing["2"]} align="center" wrap>
          <Typography.Text strong>{primary}</Typography.Text>
          {props.tags}
        </Flex>
        {name !== null && email !== null && <Muted>{email}</Muted>}
        {props.caption !== undefined && <Muted>{props.caption}</Muted>}
      </Flex>
    </Flex>
  );
}

/** A neutral status pill. `tone` picks antd's semantic colour, so it survives
 * the dark swap — a hex here would not. */
export function StatusTag(props: {
  readonly tone: "neutral" | "success" | "warning" | "danger" | "info";
  readonly children: ReactNode;
  readonly testId?: string | undefined;
}): ReactElement {
  const color =
    props.tone === "success"
      ? "success"
      : props.tone === "warning"
        ? "warning"
        : props.tone === "danger"
          ? "error"
          : props.tone === "info"
            ? "processing"
            : "default";
  return (
    <Tag
      color={color}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    >
      {props.children}
    </Tag>
  );
}

/**
 * The anchor pager three screens share.
 *
 * Two buttons and a position, and nothing that pretends to be a page NUMBER
 * the contract cannot supply: the wire addresses a page by the previous
 * page's opaque cursor, so "jump to page 7" is not a question this API can be
 * asked. The index shown is the count of steps THIS screen has taken, which
 * is a true statement about the walk rather than about the roster.
 */
export function AnchorPager(props: {
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly prevLabel: string;
  readonly nextLabel: string;
  readonly position: string;
  readonly testId?: string | undefined;
}): ReactElement | null {
  if (!props.hasPrev && !props.hasNext) return null;
  return (
    <Flex
      justify="space-between"
      align="center"
      gap={spacing["3"]}
      style={{ marginTop: spacing["4"] }}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    >
      <Button
        size="small"
        onClick={props.onPrev}
        disabled={!props.hasPrev}
        data-disabled-reason="first page of the walk — there is nothing before it"
        data-analytics="none"
        data-analytics-reason="local-ui-page-walk"
        data-testid="workspaces-pager-prev"
      >
        {props.prevLabel}
      </Button>
      <Muted>{props.position}</Muted>
      <Button
        size="small"
        onClick={props.onNext}
        disabled={!props.hasNext}
        data-disabled-reason="the server says this page is the last one"
        data-analytics="none"
        data-analytics-reason="local-ui-page-walk"
        data-testid="workspaces-pager-next"
      >
        {props.nextLabel}
      </Button>
    </Flex>
  );
}

/** One control on a list row, with the verdict that decides whether it opens. */
export interface RowActionSpec {
  readonly key: string;
  readonly gate: ActionAvailability;
  readonly label: ReactNode;
  readonly onClick: () => void;
  readonly danger?: boolean;
  readonly testId?: string | undefined;
}

/**
 * A list row's controls, and the refusal behind them stated ONCE.
 *
 * `GatedButton` prints the reason under every control it switches off, which
 * is right for a lone button and wrong for a row: three refused controls print
 * the same sentence three times, and a list of such rows becomes a wall of
 * repeated apology — six copies of "This invitation was already accepted,
 * declined, revoked or expired" on one 390px screen. The reason is a fact
 * about the ROW, not about each button, so it is rendered once, as a footnote
 * spanning the row, with every disabled control's `aria-describedby` pointing
 * at it.
 *
 * Two nodes come back, meant to be direct children of the row's flex
 * container: the controls, and the full-width footnote. Keeping the footnote
 * OUT of the action column is what stops a refused row from growing a second
 * geometry while its neighbours stay on one line.
 *
 * `reason` overrides the collected sentences where the screen has a better
 * single one — a terminal invitation refuses three controls for one reason
 * that the row's own status tag already names.
 */
export function RowActions(props: {
  readonly actions: readonly RowActionSpec[];
  readonly reason?: string | undefined;
  readonly testId?: string | undefined;
}): ReactElement {
  const t = useT();
  const reasonId = useId();

  const collected: string[] = [];
  if (props.reason !== undefined) {
    collected.push(props.reason);
  } else {
    const seen = new Set<string>();
    for (const action of props.actions) {
      if (action.gate.available) continue;
      if (seen.has(action.gate.block.code)) continue;
      seen.add(action.gate.block.code);
      collected.push(t(action.gate.block.code, action.gate.block.params));
    }
  }
  const anyBlocked = props.actions.some((action) => !action.gate.available);

  return (
    <>
      <Flex gap={spacing["2"]} align="center" wrap>
        {props.actions.map((action) => (
          <Button
            key={action.key}
            type="link"
            size="small"
            danger={action.danger === true}
            disabled={!action.gate.available}
            {...(anyBlocked && !action.gate.available
              ? { "aria-describedby": reasonId }
              : {})}
            onClick={action.onClick}
            data-analytics="none"
            data-analytics-reason="passthrough — the caller's onClick carries the tracked action"
            {...(action.testId !== undefined ? { "data-testid": action.testId } : {})}
          >
            {action.label}
          </Button>
        ))}
      </Flex>
      {collected.length > 0 && (
        <div
          id={reasonId}
          data-stapel-gated-reason=""
          style={{ flexBasis: "100%", minWidth: 0 }}
          {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
        >
          {collected.map((sentence) => (
            <div key={sentence}>
              <Muted>{sentence}</Muted>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * A failed read, said once, in a shape a 390px screen can hold.
 *
 * The substrate's `ErrorAlert` puts its retry in antd's `action` slot, which
 * is a column beside the message — at phone width the sentence is squeezed
 * into ~110px and breaks a word per line. Until the substrate stacks it
 * (VC-B6, filed), the retry goes UNDER the alert here, where it has the whole
 * width at any viewport.
 */
export function LoadFailure(props: {
  readonly error: unknown;
  readonly onRetry?: (() => void) | undefined;
  readonly testId?: string | undefined;
}): ReactElement {
  const t = useT();
  return (
    <Flex vertical gap={spacing["3"]} align="flex-start">
      <ErrorAlert
        thrown={props.error}
        style={{ width: "100%" }}
        {...(props.testId !== undefined ? { testId: props.testId } : {})}
      />
      {props.onRetry !== undefined && (
        <Button
          onClick={props.onRetry}
          data-analytics="none"
          data-analytics-reason="retry of a failed read; the read hook reports its own outcome"
          data-testid={props.testId !== undefined ? `${props.testId}-retry` : undefined}
        >
          {t(STAPEL_UI_KEYS.retry)}
        </Button>
      )}
    </Flex>
  );
}

/** The gap between the stacked blocks of a screen. One number, one place. */
export const SCREEN_STACK: CSSProperties = {
  display: "grid",
  gap: spacing["4"],
};

/** The gap between the fields inside one block. */
export const FIELD_STACK: CSSProperties = {
  display: "grid",
  gap: spacing["3"],
};
