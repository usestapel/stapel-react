/**
 * The three pieces the public list and the moderation queue both draw, kept in
 * one INTERNAL module (not exported from `./index.ts`) so the two panes cannot
 * drift into saying the same thing two ways — which is exactly what happened
 * to status treatments elsewhere in this fleet.
 */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { GatedButton, StatusTag } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ReviewListBag, ReviewListScope } from "../headless/ReviewList.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { reviewVisibility } from "../model/list.js";

/**
 * The badge a row carries.
 *
 * `null` for an ordinary published review in the PUBLIC list: everything there
 * is published, so a "Published" tag on every row would be pure noise. In the
 * moderation queue (`alwaysShow`) it is the opposite — the whole pane is about
 * which state each row is in, and an unbadged row would be the one thing a
 * moderator cannot classify at a glance.
 */
export function VisibilityTag(props: {
  status: string;
  alwaysShow?: boolean;
}): ReactElement | null {
  const t = useT();
  const visibility = reviewVisibility(props.status);
  if (visibility === "published") {
    return props.alwaysShow === true ? (
      <StatusTag status="success" testId="reviews-row-published">
        {t(REVIEWS_I18N_KEYS.moderationDonePublished)}
      </StatusTag>
    ) : null;
  }
  if (visibility === "pending") {
    return (
      <StatusTag status="warning" testId="reviews-row-pending">
        {t(REVIEWS_I18N_KEYS.statusPending)}
      </StatusTag>
    );
  }
  if (visibility === "hidden") {
    return (
      <StatusTag status="error" testId="reviews-row-hidden">
        {t(REVIEWS_I18N_KEYS.statusHidden)}
      </StatusTag>
    );
  }
  // A state this build does not know. Naming it beats rendering it as an
  // ordinary review (it may be one the server hides) and beats crashing.
  return (
    <StatusTag status="neutral" testId="reviews-row-unknown">
      {t(REVIEWS_I18N_KEYS.statusUnknown)}
    </StatusTag>
  );
}

/**
 * The sentence that ends `include=all`'s silence.
 *
 * The server narrows a non-moderator's request to published-only with no
 * error and no marker, so a host that passed the prop to the wrong viewer got
 * a quietly incomplete answer. Rendered only when the bag can say the request
 * was probably narrowed — never as a permanent disclaimer, which is the shape
 * everyone learns to stop reading.
 */
export function ScopeNotice(props: {
  scope: ReviewListScope;
  testId?: string;
}): ReactElement | null {
  const t = useT();
  if (!props.scope.narrowed) return null;
  return (
    <Typography.Text
      type="secondary"
      role="status"
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    >
      {t(REVIEWS_I18N_KEYS.listScopeNarrowed)}
    </Typography.Text>
  );
}

/**
 * "Show more", with the reason it is off when it is off — the end of the run
 * and a page in flight are different facts and get different sentences.
 */
export function MoreButton(props: { bag: ReviewListBag }): ReactElement | null {
  const t = useT();
  // Nothing to page through: "Show more" plus "That is all of them" under an
  // empty list is a disabled control and a caption restating it.
  const { state } = props.bag;
  if (state.status !== "ready" || state.data.length === 0) return null;
  return (
    <Flex justify="center" style={{ marginTop: spacing[1] }}>
      <GatedButton
        gate={props.bag.more}
        onClick={props.bag.loadMore}
        loading={props.bag.loadingMore}
        testId="reviews-load-more"
        data-analytics="none"
        data-analytics-reason="paging further into a read — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      >
        {t(REVIEWS_I18N_KEYS.listLoadMore)}
      </GatedButton>
    </Flex>
  );
}
