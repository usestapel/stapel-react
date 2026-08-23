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
import { Alert, Button, Card, Flex, Input, Rate, Typography } from "antd";
import { useActionGate, useDescribeFlowError, useT } from "@stapel/core";
import type { SignInCta, SignInCtaProp } from "@stapel/core";
import type { ReviewTarget } from "../api/types.js";
import { ReviewForm } from "../headless/ReviewForm.js";
import type { ReviewFormBag } from "../headless/ReviewForm.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { SignInLink } from "./SignInLink.js";
import { ReviewsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

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
  const describe = useDescribeFlowError();
  const { bag } = props;
  const gate = useActionGate(bag.canSubmit);

  if (bag.submitted !== null) {
    return (
      <Alert
        type="success"
        showIcon
        data-testid="reviews-form-sent"
        message={t(sentKey(bag))}
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
    return (
      <Typography.Text type="secondary" data-testid="reviews-form-sign-in">
        {t(REVIEWS_I18N_KEYS.formSignInRequired)}
        <SignInLink cta={props.signIn} testId="reviews-form-sign-in-cta" />
      </Typography.Text>
    );
  }

  return (
    <Flex vertical gap={8}>
      <Typography.Text>{t(REVIEWS_I18N_KEYS.formRatingLabel)}</Typography.Text>
      <Rate
        count={bag.bounds.max}
        value={bag.rating ?? 0}
        onChange={bag.setRating}
        data-testid="reviews-form-rate"
      />
      <Typography.Text>{t(REVIEWS_I18N_KEYS.formBodyLabel)}</Typography.Text>
      <Input.TextArea
        value={bag.body}
        onChange={(event) => bag.setBody(event.target.value)}
        placeholder={t(REVIEWS_I18N_KEYS.formBodyPlaceholder)}
        rows={3}
        data-testid="reviews-form-body"
      />
      {bag.error ? (
        <ErrorAlert testId="reviews-form-failed" error={describe(bag.error)} />
      ) : null}
      <Flex vertical gap={4} align="flex-start">
        <Button
          type="primary"
          onClick={bag.submit}
          disabled={gate.disabled}
          loading={bag.submitting}
          data-testid="reviews-form-submit"
          data-analytics="none"
          data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime and no flow machine for a single POST"
        >
          {t(REVIEWS_I18N_KEYS.formSubmit)}
        </Button>
        {gate.reason ? (
          <Typography.Text type="secondary" data-testid="reviews-form-blocked">
            {gate.reason}
          </Typography.Text>
        ) : null}
      </Flex>
    </Flex>
  );
}

export function ReviewFormCard(props: ReviewFormCardProps): ReactElement {
  const t = useT();
  // `signIn` is this card's, not the headless form's: the form knows THAT the
  // author must sign in, the container knows WHERE.
  const { mode, signIn, ...formProps } = props;
  return (
    <ReviewsSkinTheme {...(mode !== undefined ? { mode } : {})}>
      <Card size="small" data-testid="reviews-form">
        <Flex vertical gap={8}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t(REVIEWS_I18N_KEYS.formHeading)}
          </Typography.Title>
          <ReviewForm {...formProps}>
            {(bag) => <FormBody bag={bag} signIn={signIn} />}
          </ReviewForm>
        </Flex>
      </Card>
    </ReviewsSkinTheme>
  );
}
