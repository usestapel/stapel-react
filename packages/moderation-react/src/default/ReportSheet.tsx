/**
 * `<ReportSheet>` — the complaint form (DSA Art. 16(2)), as a bottom sheet on a
 * phone and a modal above it.
 *
 * ── A visitor is shown the form, not a locked box ─────────────────────────
 *
 * `GET policy` is the module's only anonymous route, and that is not an
 * accident of the backend: Art. 16 says the notice mechanism must be easy to
 * ACCESS. So a signed-out person opens this sheet, reads what can be reported
 * and why, and finds the sign-in door beside the submit — instead of a control
 * that vanished and taught them nothing.
 *
 * ── The description box is always visible ─────────────────────────────────
 *
 * `requires_description` marks it REQUIRED; it does not make it appear. A box
 * that materialises under the radio somebody just clicked moves the submit
 * button out from under their thumb on a phone, and the service accepts an
 * optional description for every reason anyway.
 *
 * ── The evidence field is not here ────────────────────────────────────────
 *
 * The wire carries `evidence` for target types nobody serves content for. The
 * one consumer, stapel-classified, stopped registering them in 0.3.x: a
 * moderator reads the message as it is, through the case card's `ContentDTO`.
 * A dialog that asked a reporter to paste their own copy of a message the
 * console can read would collect an unverifiable second version of the truth.
 */
import { useCallback } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Checkbox, Flex, Input, Radio, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useDescribeFlowError, useT } from "@stapel/core";
import type { SignInCtaProp } from "@stapel/core";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { useReport } from "../headless/useReport.js";
import { reportRefusalKey, usePolicyText } from "./copy.js";
import type { ThemeModeProp } from "./types.js";

/** The Art. 16(2) form's own hard limit — the backend's `MAX_DESCRIPTION`. */
const DESCRIPTION_MAX = 5000;

export interface ReportSheetProps extends ThemeModeProp, SignInCtaProp {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The registered target type, e.g. `"listing"` or `"review"`. */
  readonly targetType: string;
  /** The host's opaque id for the thing being reported. */
  readonly targetKey: string;
  /** The tenant/area partition, when the host runs more than one. */
  readonly scopeKey?: string;
  readonly "data-testid"?: string;
}

export function ReportSheet(props: ReportSheetProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const policyText = usePolicyText();
  const testId = props["data-testid"] ?? "moderation-report";
  const bag = useReport({
    targetType: props.targetType,
    targetKey: props.targetKey,
    ...(props.scopeKey !== undefined ? { scopeKey: props.scopeKey } : {}),
  });

  const { onClose } = props;
  const { reset } = bag;
  const close = useCallback((): void => {
    reset();
    onClose();
  }, [onClose, reset]);

  const accepted = bag.state.step === "accepted";
  const refusal = bag.state.step === "refused" ? bag.state.error : undefined;
  const namedRefusal = refusal !== undefined ? reportRefusalKey(refusal) : undefined;

  const signInDoor: ReactNode =
    props.signIn === undefined ? null : props.signIn.href !== undefined ? (
      <Typography.Link href={props.signIn.href} data-testid={`${testId}-sign-in`}>
        {t(MODERATION_I18N_KEYS.reportSignInLink)}
      </Typography.Link>
    ) : (
      <Button
        type="link"
        size="small"
        data-testid={`${testId}-sign-in`}
        data-analytics="none"
        data-analytics-reason="hands the click to the host's sign-in seam; the host tracks its own door"
        onClick={props.signIn.onSignIn}
      >
        {t(MODERATION_I18N_KEYS.reportSignInLink)}
      </Button>
    );

  const footer = accepted ? (
    <Button
      type="primary"
      data-testid={`${testId}-done`}
      data-analytics="none"
      data-analytics-reason="closes an already-recorded outcome; the submission itself is the tracked step"
      onClick={close}
    >
      {t(MODERATION_I18N_KEYS.reportDone)}
    </Button>
  ) : (
    <GatedButton
      gate={bag.submit}
      type="primary"
      testId={`${testId}-submit`}
      data-analytics="flow"
      onClick={bag.run}
    >
      {t(MODERATION_I18N_KEYS.reportSubmit)}
    </GatedButton>
  );

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <SkinDialog
        open={props.open}
        onClose={close}
        title={t(MODERATION_I18N_KEYS.reportTitle)}
        dismissLabel={t(MODERATION_I18N_KEYS.dialogDismiss)}
        footer={footer}
        data-testid={testId}
      >
        {accepted ? (
          <Flex vertical gap={spacing["2"]} data-testid={`${testId}-accepted`}>
            <Typography.Text strong>
              {t(MODERATION_I18N_KEYS.reportAccepted, {
                caseRef: bag.state.step === "accepted" ? bag.state.caseRef : "",
              })}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t(MODERATION_I18N_KEYS.reportAcceptedHint)}
            </Typography.Text>
          </Flex>
        ) : (
          <Flex vertical gap={spacing["3"]}>
            {bag.visitor ? (
              <ErrorAlert
                variant="inline"
                testId={`${testId}-visitor`}
                message={t(MODERATION_I18N_KEYS.reportSignIn)}
                {...(signInDoor !== null ? { action: signInDoor } : {})}
              />
            ) : null}

            {refusal !== undefined ? (
              namedRefusal !== undefined ? (
                <ErrorAlert testId={`${testId}-refused`} message={t(namedRefusal)} />
              ) : (
                <ErrorAlert testId={`${testId}-refused`} error={describe(refusal)} />
              )
            ) : null}

            <LoadList
              state={bag.reasons}
              testId={`${testId}-reasons`}
              skeletonRows={4}
              onRetry={bag.refetchPolicy}
              empty={
                <EmptyState
                  testId={`${testId}-no-reasons`}
                  title={t(MODERATION_I18N_KEYS.reportBlockedNoReason)}
                />
              }
            >
              {(reasons) => (
                <Flex vertical gap={spacing["2"]}>
                  <Typography.Text strong>
                    {t(MODERATION_I18N_KEYS.reportReason)}
                  </Typography.Text>
                  <Radio.Group
                    value={bag.reasonCode}
                    aria-label={t(MODERATION_I18N_KEYS.reportReason)}
                    data-testid={`${testId}-reason-group`}
                    onChange={(event) => {
                      bag.setReasonCode(String(event.target.value));
                    }}
                  >
                    <Flex vertical gap={spacing["2"]}>
                      {reasons.map((reason) => (
                        <Radio key={reason.code} value={reason.code}>
                          <Flex vertical>
                            <Typography.Text>
                              {policyText.reasonLabel(reason)}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {policyText.reasonDescription(reason)}
                            </Typography.Text>
                          </Flex>
                        </Radio>
                      ))}
                    </Flex>
                  </Radio.Group>
                </Flex>
              )}
            </LoadList>

            <Flex vertical gap={spacing["1"]}>
              <Typography.Text strong>
                {t(MODERATION_I18N_KEYS.reportDescription)}
              </Typography.Text>
              <Typography.Text type="secondary">
                {t(
                  bag.descriptionRequired
                    ? MODERATION_I18N_KEYS.reportDescriptionRequired
                    : MODERATION_I18N_KEYS.reportDescriptionOptional
                )}
              </Typography.Text>
              <Input.TextArea
                value={bag.description}
                rows={4}
                maxLength={DESCRIPTION_MAX}
                showCount
                aria-label={t(MODERATION_I18N_KEYS.reportDescription)}
                data-testid={`${testId}-description`}
                onChange={(event) => {
                  bag.setDescription(event.target.value);
                }}
              />
            </Flex>

            <Checkbox
              checked={bag.goodFaith}
              data-testid={`${testId}-good-faith`}
              onChange={(event) => {
                bag.setGoodFaith(event.target.checked);
              }}
            >
              {t(MODERATION_I18N_KEYS.reportGoodFaith)}
            </Checkbox>

            {bag.automatedScreening ? (
              <Typography.Text type="secondary" data-testid={`${testId}-automated`}>
                {t(MODERATION_I18N_KEYS.reportAutomatedNotice)}
              </Typography.Text>
            ) : null}
          </Flex>
        )}
      </SkinDialog>
    </SkinTheme>
  );
}
