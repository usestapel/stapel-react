/**
 * The two axes, drawn as two.
 *
 * `<LifecycleTag>` is the state; `<ModerationNote>` is what the moderation
 * axis adds ON TOP of it, and it renders nothing when there is nothing to add
 * (an approved listing owes its owner no note). Keeping them separate is what
 * makes "Published" and "changes under review" appear side by side rather
 * than one overwriting the other — the failure `model/status.ts` exists to
 * prevent, made visual.
 *
 * A tone maps to an antd preset here and nowhere else. No hex leaves this
 * file, because none enters it: the presets resolve through the theme, which
 * resolves through `@stapel/tokens`.
 */
import type { ReactElement } from "react";
import { Alert, Tag } from "antd";
import { useT } from "@stapel/core";
import type { ListingStatusTone, ListingStatusView } from "../model/status.js";

const TONE_COLOR: Readonly<Record<ListingStatusTone, string>> = {
  neutral: "default",
  waiting: "processing",
  good: "success",
  warning: "warning",
  stopped: "error",
};

const TONE_ALERT: Readonly<
  Record<ListingStatusTone, "info" | "success" | "warning" | "error">
> = {
  neutral: "info",
  waiting: "info",
  good: "success",
  warning: "warning",
  stopped: "error",
};

export interface ListingStatusProps {
  readonly status: ListingStatusView;
}

/** The lifecycle state — the field that decides whether anyone else can see
 * this listing. */
export function LifecycleTag(props: ListingStatusProps): ReactElement {
  const t = useT();
  return (
    <Tag
      color={TONE_COLOR[props.status.lifecycle.tone]}
      data-testid="listings-status-tag"
      data-listing-status={props.status.lifecycle.status}
    >
      {t(props.status.lifecycle.labelKey)}
    </Tag>
  );
}

/**
 * What the moderation axis adds. Renders `null` when it adds nothing, so a
 * calm listing shows no banner at all.
 */
export function ModerationNote(props: ListingStatusProps): ReactElement | null {
  const t = useT();
  const notice = props.status.moderation;
  if (notice === undefined) return null;
  return (
    <Alert
      type={TONE_ALERT[notice.tone]}
      showIcon
      data-testid="listings-moderation-note"
      data-listing-moderation={notice.moderationStatus}
      data-listing-live-under-review={String(notice.liveDuringReview)}
      message={t(notice.messageKey)}
    />
  );
}

/** Both, in the order a person reads them: what it IS, then what is happening
 * to it. */
export function ListingStatusBlock(props: ListingStatusProps): ReactElement {
  return (
    <>
      <LifecycleTag status={props.status} />
      <ModerationNote status={props.status} />
    </>
  );
}
