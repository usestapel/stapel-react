/**
 * `<DsarForm variant="app" | "anonymous">` — the front door of Art. 12.
 *
 * ── One component, two genuinely different callers ────────────────────────
 *
 * `POST /dsar` is `AllowAny`, because the form a regulator expects to exist
 * cannot require a login. The two variants are not a style choice:
 *
 * - `app` — a signed-in person. The server takes their email off the session
 *   and IGNORES a supplied one, so the form does not ask for it. Asking would
 *   invite somebody to type a different address and believe the answer will go
 *   there.
 * - `anonymous` — a public /privacy page. Email is REQUIRED (it is the only
 *   identity the request has), and a captcha token is required whenever the
 *   deployment has a captcha backend configured. The token comes from the
 *   HOST's challenge widget through `captchaToken`: this package does not ship
 *   a captcha, does not know which provider a deployment uses, and refuses to
 *   guess at one on the page where a stranger asks about their data.
 *
 * ── What the success arm shows, and why it is not a cleared form ──────────
 *
 * The acknowledgement is automatic (the row's creation sends it and stamps
 * `ack_sent_at`), which is how the three-business-day clock is met by
 * machinery rather than by an operator remembering. So the success arm has
 * something real to hand over: a reference number and the two statutory dates.
 * A form that reset itself would leave the person with nothing to quote.
 *
 * ── What this form deliberately cannot do ─────────────────────────────────
 *
 * An anonymous `kind=erasure` does NOT start an erasure. Turning an unverified
 * email into a deletion is an oracle, so matching a request to an account is a
 * staff action. Nothing here papers over that with a client-side lookup, and
 * the copy never promises deletion — it promises an answer, by a date.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Card, Flex, Form, Input, Select, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { useDescribeFlowError, useI18n, useT } from "@stapel/core";
import type { DsarKind } from "../api/types.js";
import { toFlowError } from "../flows/errors.js";
import { GDPR_I18N_KEYS } from "../i18n/keys.js";
import { formatDeletionDate } from "../model/dates.js";
import { useDsar } from "../model/dsar.js";
import { isCaptchaRefusal } from "../model/refusals.js";
import type { ThemeModeProp } from "./types.js";

export interface DsarFormProps extends ThemeModeProp {
  /** `"app"` for a signed-in person, `"anonymous"` for the public form. */
  readonly variant: "app" | "anonymous";
  /**
   * The captcha token the host's challenge widget produced. Anonymous variant
   * only; ignored for `app`. Absent is legal — a deployment with no captcha
   * backend leaves the form open, and a client that required a token would
   * break that configuration.
   */
  readonly captchaToken?: string;
  /** Preselected kind, e.g. a "delete my data" link that lands here. */
  readonly defaultKind?: DsarKind;
}

const KINDS: readonly { readonly value: DsarKind; readonly labelKey: string }[] = [
  { value: "access", labelKey: GDPR_I18N_KEYS.dsarKindAccess },
  { value: "erasure", labelKey: GDPR_I18N_KEYS.dsarKindErasure },
  { value: "rectification", labelKey: GDPR_I18N_KEYS.dsarKindRectification },
  { value: "portability", labelKey: GDPR_I18N_KEYS.dsarKindPortability },
];

export function DsarForm(props: DsarFormProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const bag = useDsar();
  const anonymous = props.variant === "anonymous";

  const [kind, setKind] = useState<DsarKind>(props.defaultKind ?? "access");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [emailMissing, setEmailMissing] = useState(false);

  const submitted = bag.submitted;
  const error = bag.submit.error;
  // The anonymous form's own precondition. Refused HERE rather than by the
  // server's bare 400: `POST /dsar` answers `error.400.bad_request` for a
  // missing email, which says nothing about which field, on the one page whose
  // visitor has no account and no support channel to ask.
  const missingEmail = anonymous && email.trim().length === 0;

  if (submitted !== undefined) {
    return (
      <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
        <Card
          data-testid="gdpr-dsar"
          title={t(GDPR_I18N_KEYS.dsarHeading)}
          size="small"
        >
          <Flex vertical gap={spacing[2]} data-testid="gdpr-dsar-submitted">
            <Alert
              type="success"
              showIcon
              message={t(GDPR_I18N_KEYS.dsarSubmitted)}
            />
            <Typography.Text strong data-testid="gdpr-dsar-reference">
              {t(GDPR_I18N_KEYS.dsarReference, { id: submitted.request_id })}
            </Typography.Text>
            {/* Both statutory clocks, as the dates the server computed them
                to be — three BUSINESS days is not a sum a browser can do. */}
            <Typography.Text type="secondary">
              {t(GDPR_I18N_KEYS.dsarAckBy, {
                date: formatDeletionDate(submitted.ack_due_at, locale),
              })}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t(GDPR_I18N_KEYS.dsarResolveBy, {
                date: formatDeletionDate(submitted.resolve_due_at, locale),
              })}
            </Typography.Text>
          </Flex>
        </Card>
      </SkinTheme>
    );
  }

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        data-testid="gdpr-dsar"
        title={t(GDPR_I18N_KEYS.dsarHeading)}
        size="small"
      >
        <Flex vertical gap={spacing[3]}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t(GDPR_I18N_KEYS.dsarExplain)}
          </Typography.Paragraph>

          <Form layout="vertical" component="div">
            <Form.Item label={t(GDPR_I18N_KEYS.dsarKindLabel)}>
              <Select
                data-testid="gdpr-dsar-kind"
                aria-label={t(GDPR_I18N_KEYS.dsarKindLabel)}
                value={kind}
                onChange={(next: DsarKind) => setKind(next)}
                options={KINDS.map((entry) => ({
                  value: entry.value,
                  label: t(entry.labelKey),
                }))}
                data-analytics="none"
                data-analytics-reason="form field — the tracked point is the submit; host app wraps with its own tracked()"
              />
            </Form.Item>

            {anonymous ? (
              <Form.Item label={t(GDPR_I18N_KEYS.dsarEmailLabel)}>
                <Input
                  data-testid="gdpr-dsar-email"
                  type="email"
                  aria-label={t(GDPR_I18N_KEYS.dsarEmailLabel)}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Form.Item>
            ) : null}

            <Form.Item label={t(GDPR_I18N_KEYS.dsarNoteLabel)}>
              <Input.TextArea
                data-testid="gdpr-dsar-note"
                aria-label={t(GDPR_I18N_KEYS.dsarNoteLabel)}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Form.Item>
          </Form>

          {emailMissing ? (
            <Alert
              type="warning"
              showIcon
              data-testid="gdpr-dsar-email-required"
              message={t(GDPR_I18N_KEYS.dsarEmailRequired)}
            />
          ) : null}

          {error != null ? (
            <Alert
              type="warning"
              showIcon
              data-testid={
                isCaptchaRefusal(error) ? "gdpr-dsar-captcha" : "gdpr-dsar-failed"
              }
              message={describe(toFlowError(error)).message}
            />
          ) : null}

          <div>
            <Button
              type="primary"
              loading={bag.submit.isPending}
              data-testid="gdpr-dsar-submit"
              data-analytics="none"
              data-analytics-reason="statutory intake write — host app wraps with its own tracked()"
              onClick={() => {
                if (missingEmail) {
                  setEmailMissing(true);
                  return;
                }
                setEmailMissing(false);
                bag.submit.mutate(
                  anonymous
                    ? {
                        variant: "anonymous",
                        kind,
                        email: email.trim(),
                        ...(note.length > 0 ? { note } : {}),
                        ...(props.captchaToken !== undefined
                          ? { captchaToken: props.captchaToken }
                          : {}),
                      }
                    : {
                        variant: "app",
                        kind,
                        ...(note.length > 0 ? { note } : {}),
                      }
                );
              }}
            >
              {t(GDPR_I18N_KEYS.dsarSubmit)}
            </Button>
          </div>
        </Flex>
      </Card>
    </SkinTheme>
  );
}
