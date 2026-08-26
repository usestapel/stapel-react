/**
 * `<ReviewResponseComposer>` — the seller's reply, shown and written in the
 * same place.
 *
 * The reply was DISPLAYED by this pair from the first release and could never
 * be WRITTEN by it: `POST {id}/response` existed in the schema, in the
 * manifest and in the error catalogue, and in no screen anywhere in the fleet.
 * This component is the missing half, and it is deliberately the same
 * component as the display — a reply and the box that writes it are one thing
 * on the page, not two, and the transition between them is the whole point:
 *
 *   no reply, may write      → the composer, with the one-shot rule stated
 *   no reply, may not write  → the reason, beside a switched-off control
 *   reply exists             → the reply, and no box at all
 *
 * The middle case is why the control is disabled rather than absent. A seller
 * whose ownership callback is mis-wired sees "the server does not accept you
 * as the owner of this item" — which is a bug report — instead of a page that
 * quietly has no reply button on it, which is nothing.
 */
import type { ReactElement } from "react";
import { Card, Flex, Input, Typography } from "antd";
import { useT } from "@stapel/core";
import type { SignInCta, SignInCtaProp } from "@stapel/core";
import {
  ErrorAlert,
  GatedButton,
  PaneGate,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { Review, ReviewTarget } from "../api/types.js";
import { ReviewResponseForm } from "../headless/ReviewResponseForm.js";
import type { ReviewResponseBag } from "../headless/ReviewResponseForm.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { SignInLink } from "./SignInLink.js";
import type { ThemeModeProp } from "./types.js";

export interface ReviewResponseComposerProps
  extends ThemeModeProp,
    SignInCtaProp {
  readonly target: ReviewTarget;
  readonly review: Review;
  /** Does the host believe this viewer owns the reviewed item? */
  readonly canRespond?: boolean;
  /** Format the reply's `created_at`. Absent: the date is not shown. */
  readonly renderDate?: (iso: string) => ReactElement | string | null;
  /**
   * Render nothing at all when there is no reply and the viewer may not write
   * one. The listing page passes this: a buyer reading reviews has no use for
   * "only the owner can reply" under every row. A seller console does not.
   */
  readonly quiet?: boolean;
}

/** The reply itself, once it exists. Read-only, forever — there is no edit. */
function ExistingReply(props: {
  bag: ReviewResponseBag;
  renderDate: ReviewResponseComposerProps["renderDate"];
}): ReactElement | null {
  const t = useT();
  const { response } = props.bag;
  if (response === null) return null;
  return (
    <Card size="small" data-testid="reviews-row-response">
      <Flex vertical gap={spacing[1]}>
        <Flex align="baseline" gap={spacing[2]} wrap>
          <Typography.Text type="secondary">
            {t(REVIEWS_I18N_KEYS.responseHeading)}
          </Typography.Text>
          {props.renderDate?.(response.created_at) ?? null}
          {props.bag.justSent ? (
            <Typography.Text type="success" data-testid="reviews-response-sent">
              {t(REVIEWS_I18N_KEYS.responseSent)}
            </Typography.Text>
          ) : null}
        </Flex>
        <Typography.Paragraph style={{ margin: 0 }}>
          {response.body}
        </Typography.Paragraph>
      </Flex>
    </Card>
  );
}

/**
 * The composer, or the ONE sentence that says why there is none.
 *
 * `PaneGate` on `canWrite`: a viewer who does not own the item saw a
 * live-looking textarea, a switched-off Send and a 12px caption — a form that
 * invites typing and then refuses it. A refusal that is about the VIEWER
 * belongs to the whole composer, said once, with the door beside it.
 */
function Composer(props: {
  bag: ReviewResponseBag;
  signIn: SignInCta | undefined;
}): ReactElement {
  const t = useT();
  const { bag } = props;
  return (
    <PaneGate
      gate={bag.canWrite}
      testId="reviews-response-gate"
      action={
        bag.signInRequired ? (
          <SignInLink
            cta={props.signIn}
            variant="primary"
            testId="reviews-response-sign-in"
          />
        ) : undefined
      }
    >
      <Flex vertical gap={spacing[2]} data-testid="reviews-response-composer">
      <Typography.Text strong>
        {t(REVIEWS_I18N_KEYS.responseComposeLabel)}
      </Typography.Text>
      <Input.TextArea
        value={bag.body}
        onChange={(event) => bag.setBody(event.target.value)}
        placeholder={t(REVIEWS_I18N_KEYS.responsePlaceholder)}
        rows={3}
        aria-label={t(REVIEWS_I18N_KEYS.responseComposeLabel)}
        data-testid="reviews-response-body"
      />
      {/* Said BEFORE the one reply is spent, not after: the module stores at
          most one and there is no endpoint that edits or removes it. */}
      <Typography.Text type="secondary" data-testid="reviews-response-one-shot">
        {t(REVIEWS_I18N_KEYS.responseOnlyOne)}
      </Typography.Text>
      {/* Renders null for `undefined` — the named refusals (not the owner,
          already answered, replies switched off) are gate reasons beside the
          button, not banners. */}
      <ErrorAlert thrown={bag.error} testId="reviews-response-failed" />
      <Flex align="flex-start" gap={spacing[2]} wrap>
        <GatedButton
          gate={bag.canSubmit}
          type="primary"
          onClick={bag.submit}
          loading={bag.submitting}
          testId="reviews-response-submit"
          data-analytics="none"
          data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime"
        >
          {t(REVIEWS_I18N_KEYS.responseSubmit)}
        </GatedButton>
      </Flex>
      </Flex>
    </PaneGate>
  );
}

export function ReviewResponseComposer(
  props: ReviewResponseComposerProps
): ReactElement | null {
  const {
    mode,
    surface,
    signIn,
    renderDate,
    quiet = false,
    target,
    review,
    canRespond,
  } = props;
  return (
    <SkinTheme
      {...(mode !== undefined ? { mode } : {})}
      surface={surface ?? "bare"}
    >
      <ReviewResponseForm
        target={target}
        review={review}
        {...(canRespond !== undefined ? { canRespond } : {})}
      >
        {(bag) => {
          if (bag.response !== null) {
            return <ExistingReply bag={bag} renderDate={renderDate} />;
          }
          // Nothing to show a reader: no reply exists and this viewer was
          // never offered the box. `quiet` is the listing page — a buyer has
          // no use for "only the owner can reply" under every row. A console
          // leaves it off and gets the switched-off control with its reason.
          if (quiet && canRespond !== true) return null;
          return <Composer bag={bag} signIn={signIn} />;
        }}
      </ReviewResponseForm>
    </SkinTheme>
  );
}
