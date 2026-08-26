/**
 * `<ReviewFormCard>` — "rate this", in antd.
 *
 * Two outcomes get their own sentence rather than a red banner, because
 * neither is a fault of the person in front of the screen:
 *
 * - **already rated** (`error.400.reviews_duplicate_review`, a 400 — see
 *   `model/refusals.ts`): the form collapses into a note. The same note shows
 *   when the host told us up front via `alreadyReviewed`, so the two paths to
 *   the same fact look the same;
 * - **sent but not visible**: under pre-moderation the created row comes back
 *   `pending`, and the author is told it will appear once checked. Saying
 *   "published" there, or saying nothing, leaves them hunting for a review
 *   that is deliberately invisible to them.
 */
import type { ReactElement } from "react";
import { Alert, Card, Flex, Input, Rate, Typography } from "antd";
import { useT } from "@stapel/core";
import type { SignInCta, SignInCtaProp } from "@stapel/core";
import {
  ErrorAlert,
  GatedButton,
  PHONE_CONTROL_HEIGHT,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ReviewTarget } from "../api/types.js";
import { ReviewForm } from "../headless/ReviewForm.js";
import type { ReviewFormBag } from "../headless/ReviewForm.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { SignInLink } from "./SignInLink.js";
import type { ThemeModeProp } from "./types.js";

/**
 * Five stars per row at the phone touch floor: `PHONE_CONTROL_HEIGHT` is the
 * pitch the substrate gives a star, so five of them plus their gaps is the
 * width at which a 1–10 scale wraps 5 + 5.
 */
const STAR_ROW_MEASURE = `${String(PHONE_CONTROL_HEIGHT * 5)}px`;

export interface ReviewFormCardProps extends ThemeModeProp, SignInCtaProp {
  readonly target: ReviewTarget;
  /** The host already knows this author has reviewed the target (optimistic). */
  readonly alreadyReviewed?: boolean;
}

/** The sentence for a review that exists but may not be on the page. */
function sentKey(bag: ReviewFormBag): string {
  switch (bag.submittedVisibility) {
    case "published":
      return REVIEWS_I18N_KEYS.formSentPublished;
    case "pending":
      return REVIEWS_I18N_KEYS.formSentPending;
    case "hidden":
      return REVIEWS_I18N_KEYS.formSentHidden;
    default:
      return REVIEWS_I18N_KEYS.formSentUnknown;
  }
}

function FormBody(props: {
  bag: ReviewFormBag;
  signIn: SignInCta | undefined;
}): ReactElement {
  const t = useT();
  const { bag } = props;

  if (bag.submitted !== null) {
    return (
      <Alert
        type="success"
        showIcon
        data-testid="reviews-form-sent"
        title={t(sentKey(bag))}
      />
    );
  }

  if (bag.alreadyReviewed) {
    return (
      <Typography.Text type="secondary" data-testid="reviews-form-duplicate">
        {t(REVIEWS_I18N_KEYS.submitBlockedDuplicate)}
      </Typography.Text>
    );
  }

  if (bag.signInRequired) {
    // The only thing left to do on this card, so it looks like it: the reason
    // as a sentence and the door as the card's primary, not a 24px text link
    // trailing the sentence with no punctuation between them.
    return (
      <Flex vertical align="flex-start" gap={spacing[2]} data-testid="reviews-form-sign-in">
        <Typography.Text type="secondary">
          {t(REVIEWS_I18N_KEYS.formSignInRequired)}
        </Typography.Text>
        <SignInLink
          cta={props.signIn}
          variant="primary"
          testId="reviews-form-sign-in-cta"
        />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={spacing[2]}>
      <Typography.Text>{t(REVIEWS_I18N_KEYS.formRatingLabel)}</Typography.Text>
      {/* The one interaction in the package. The substrate's phone branch
          gives the stars the touch floor; the measure here is what keeps a
          max of 10 from breaking 8 + 2 across two ragged rows — five per row,
          so the second row reads as a continuation of a scale rather than as
          two leftover stars. */}
      <div style={{ maxWidth: STAR_ROW_MEASURE }}>
        <Rate
          count={bag.bounds.max}
          value={bag.rating ?? 0}
          onChange={bag.setRating}
          data-testid="reviews-form-rate"
        />
      </div>
      <Typography.Text type="secondary" data-testid="reviews-form-rate-hint">
        {t(REVIEWS_I18N_KEYS.formRatingHint, {
          min: bag.bounds.min,
          max: bag.bounds.max,
        })}
      </Typography.Text>
      <Typography.Text>{t(REVIEWS_I18N_KEYS.formBodyLabel)}</Typography.Text>
      <Input.TextArea
        value={bag.body}
        onChange={(event) => bag.setBody(event.target.value)}
        placeholder={t(REVIEWS_I18N_KEYS.formBodyPlaceholder)}
        aria-label={t(REVIEWS_I18N_KEYS.formBodyLabel)}
        rows={3}
        data-testid="reviews-form-body"
      />
      <ErrorAlert thrown={bag.error} testId="reviews-form-failed" />
      <GatedButton
        gate={bag.canSubmit}
        type="primary"
        onClick={bag.submit}
        loading={bag.submitting}
        testId="reviews-form-submit"
        data-analytics="none"
        data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime and no flow machine for a single POST"
      >
        {t(REVIEWS_I18N_KEYS.formSubmit)}
      </GatedButton>
    </Flex>
  );
}

export function ReviewFormCard(props: ReviewFormCardProps): ReactElement {
  const t = useT();
  // `signIn` is this card's, not the headless form's: the form knows THAT the
  // author must sign in, the container knows WHERE.
  const { mode, surface, signIn, ...formProps } = props;
  return (
    <SkinTheme
      {...(mode !== undefined ? { mode } : {})}
      surface={surface ?? "bare"}
    >
      <Card size="small" data-testid="reviews-form">
        <Flex vertical gap={spacing[2]}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t(REVIEWS_I18N_KEYS.formHeading)}
          </Typography.Title>
          <ReviewForm {...formProps}>
            {(bag) => <FormBody bag={bag} signIn={signIn} />}
          </ReviewForm>
        </Flex>
      </Card>
    </SkinTheme>
  );
}
