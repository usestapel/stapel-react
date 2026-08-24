/**
 * The two axes, drawn as two — in ONE visual treatment.
 *
 * `<LifecycleTag>` is the state; `<ModerationNote>` is what the moderation
 * axis adds ON TOP of it, and it renders nothing when there is nothing to add
 * (an approved listing owes its owner no note). Keeping them separate is what
 * makes "Published" and "changes under review" appear side by side rather
 * than one overwriting the other — the failure `model/status.ts` exists to
 * prevent, made visual.
 *
 * ── Why the note is a line and not an Alert ────────────────────────────────
 *
 * It was an antd `Alert`, toned by the moderation status, and the visual pass
 * measured the result: one concept drawn three ways down a single dashboard —
 * a full-bleed olive bar for one row, a full-bleed grey bar for the next, bare
 * red text for a third — and a phone screen where a 340px khaki box wrapped
 * one sentence over six ragged lines. A status is a status: ONE tag carrying
 * the tone, and the sentence beneath it as ordinary text. Loud is not the
 * same as clear, and a row that shouts three different ways is neither.
 *
 * A tone maps to an antd preset here and nowhere else. No hex leaves this
 * file, because none enters it: the presets resolve through the theme, which
 * resolves through `@stapel/tokens`.
 */
import type { ReactElement } from "react";
import { Flex, Tag, Typography, theme as antdTheme } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { ListingStatusTone, ListingStatusView } from "../model/status.js";

const TONE_COLOR: Readonly<Record<ListingStatusTone, string>> = {
  neutral: "default",
  waiting: "processing",
  good: "success",
  warning: "warning",
  stopped: "error",
};

/** How urgent the sentence beneath the tag reads. `warning` is the only tone
 * that asks the owner to DO something, so it is the only one that gets antd's
 * danger colour; the rest are secondary text. */
const TONE_TEXT: Readonly<
  Record<ListingStatusTone, "secondary" | "warning" | "success">
> = {
  neutral: "secondary",
  waiting: "secondary",
  good: "success",
  warning: "warning",
  stopped: "warning",
};

export interface ListingStatusProps {
  readonly status: ListingStatusView;
}

/** The lifecycle state — the field that decides whether anyone else can see
 * this listing. One tag, never full-bleed, never bare text. */
export function LifecycleTag(props: ListingStatusProps): ReactElement {
  const t = useT();
  return (
    <Tag
      color={TONE_COLOR[props.status.lifecycle.tone]}
      data-testid="listings-status-tag"
      data-listing-status={props.status.lifecycle.status}
      style={{ marginInlineEnd: 0 }}
    >
      {t(props.status.lifecycle.labelKey)}
    </Tag>
  );
}

/**
 * What the moderation axis adds, as one sentence. Renders `null` when it adds
 * nothing, so a calm listing shows no note at all.
 */
export function ModerationNote(props: ListingStatusProps): ReactElement | null {
  const t = useT();
  const { token } = antdTheme.useToken();
  const notice = props.status.moderation;
  if (notice === undefined) return null;
  return (
    <Typography.Text
      type={TONE_TEXT[notice.tone]}
      data-testid="listings-moderation-note"
      data-listing-moderation={notice.moderationStatus}
      data-listing-live-under-review={String(notice.liveDuringReview)}
      style={{ fontSize: token.fontSizeSM }}
    >
      {t(notice.messageKey)}
    </Typography.Text>
  );
}

/** Both, in the order a person reads them: what it IS, then what is happening
 * to it. A column so the sentence can never be squeezed beside the tag on a
 * 390px row — the shape that split "Draf/t" across two lines. */
export function ListingStatusBlock(props: ListingStatusProps): ReactElement {
  return (
    <Flex vertical align="flex-start" gap={spacing[1]} style={{ minWidth: 0 }}>
      <LifecycleTag status={props.status} />
      <ModerationNote status={props.status} />
    </Flex>
  );
}
