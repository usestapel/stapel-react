/**
 * `<FixIssueDialog>` — close an issue with the release that claims the fix.
 *
 * ── Both fields are optional, and the dialog says what that costs ─────────
 *
 * `POST /issues/{id}/fix` takes `version` and `sha`, both optional, both
 * recorded. An issue closed with neither is still closed — just useless the
 * day it regresses and somebody asks which deploy was supposed to have
 * stopped it. So the submit is never blocked; the consequence is stated in one
 * line under the fields, and only while both are empty.
 *
 * That is the difference between a form that refuses and a form that informs.
 * A CI caller has a sha, a person closing a hotfix by hand may have only a
 * version, and a person closing a duplicate has neither — refusing the third
 * would make the tracker lie about what is still open, which is the one thing
 * it exists not to do.
 *
 * ── The endpoint is `/fix`, not `PATCH {status: "fixed"}` ─────────────────
 *
 * Only the POST records the release AND zeroes `count_since_fix`, and that
 * counter is the entire answer to "did it come back?". See `model/status.ts`.
 *
 * ── The body only exists while the dialog is open ─────────────────────────
 *
 * The form is a separate component rendered under `open`, so closing it drops
 * the typed version, the typed sha AND the mutation's error together. The
 * alternative — an effect that resets three pieces of state — is a render loop
 * waiting for a dependency array to be wrong, and a half-filled form that
 * survives off-screen is the bug that shape produces when it does not loop.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Input, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { ErrorAlert, SkinButton, SkinDialog } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import type { IssueLevel } from "../api/types.js";
import { useIssueStatus } from "../model/status.js";
import { ALERTS_I18N_KEYS } from "../i18n/keys.js";
import { DIALOG_ACTION_BAR_STYLE } from "./layout.js";
import type { ThemeModeProp } from "./types.js";

export interface FixIssueDialogProps extends ThemeModeProp {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly issueId: string;
  /** The row's level — the analytics prop only; it never reaches the wire. */
  readonly level?: IssueLevel;
  /** Called after the store has saved the close. */
  readonly onFixed?: () => void;
  readonly testId?: string;
}

export function FixIssueDialog(props: FixIssueDialogProps): ReactElement {
  const t = useT();
  const testId = props.testId ?? "alerts-fix";
  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(ALERTS_I18N_KEYS.fixTitle)}
      dismissLabel={t(ALERTS_I18N_KEYS.dismiss)}
      data-testid={testId}
    >
      {props.open ? <FixIssueForm {...props} testId={testId} /> : null}
    </SkinDialog>
  );
}

function FixIssueForm(
  props: FixIssueDialogProps & { readonly testId: string }
): ReactElement {
  const t = useT();
  const { testId } = props;
  const { fix } = useIssueStatus();
  const [version, setVersion] = useState("");
  const [sha, setSha] = useState("");

  const blank = version.trim().length === 0 && sha.trim().length === 0;

  const submit = (): void => {
    fix.mutate(
      {
        issueId: props.issueId,
        version: version.trim(),
        sha: sha.trim(),
        ...(props.level !== undefined ? { level: props.level } : {}),
      },
      {
        onSuccess: () => {
          props.onFixed?.();
          props.onClose();
        },
      }
    );
  };

  return (
    <Flex vertical gap={spacing[3]}>
      <Typography.Text type="secondary">
        {t(ALERTS_I18N_KEYS.fixBody)}
      </Typography.Text>

      <Flex vertical gap={spacing[1]}>
        <Typography.Text strong>{t(ALERTS_I18N_KEYS.fixVersion)}</Typography.Text>
        <Input
          value={version}
          aria-label={t(ALERTS_I18N_KEYS.fixVersion)}
          placeholder={t(ALERTS_I18N_KEYS.fixVersionHint)}
          data-testid={`${testId}-version`}
          maxLength={64}
          onChange={(event) => setVersion(event.target.value)}
        />
      </Flex>

      <Flex vertical gap={spacing[1]}>
        <Typography.Text strong>{t(ALERTS_I18N_KEYS.fixSha)}</Typography.Text>
        <Input
          value={sha}
          aria-label={t(ALERTS_I18N_KEYS.fixSha)}
          placeholder={t(ALERTS_I18N_KEYS.fixShaHint)}
          data-testid={`${testId}-sha`}
          maxLength={64}
          onChange={(event) => setSha(event.target.value)}
        />
      </Flex>

      {blank ? (
        <Typography.Text type="warning" data-testid={`${testId}-blank`}>
          {t(ALERTS_I18N_KEYS.fixBlank)}
        </Typography.Text>
      ) : null}

      <ErrorAlert testId={`${testId}-failed`} thrown={fix.error} variant="inline" />

      <Flex gap={spacing[2]} justify="end" style={DIALOG_ACTION_BAR_STYLE}>
        <SkinButton
          data-testid={`${testId}-cancel`}
          data-analytics="none"
          data-analytics-reason="dismissing a dialog decides nothing about the issue"
          onClick={props.onClose}
        >
          {t(ALERTS_I18N_KEYS.cancel)}
        </SkinButton>
        <SkinButton
          type="primary"
          loading={fix.isPending}
          data-testid={`${testId}-submit`}
          data-analytics="none"
          data-analytics-reason="alerts.issue.fixed is emitted by the model layer on success"
          onClick={submit}
        >
          {t(ALERTS_I18N_KEYS.fixSubmit)}
        </SkinButton>
      </Flex>
    </Flex>
  );
}
