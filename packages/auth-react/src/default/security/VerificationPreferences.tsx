/**
 * `<VerificationPreferences/>` — the settings half of step-up verification
 * (auth-sa.md §11). The CHALLENGE has existed since 0.25; the SETTING never
 * had a screen, so nobody could decide when they wanted to be asked.
 *
 * ## Rows are SPARSE, and that is a fact about the contract
 *
 * `GET /verification/preferences/` returns one row per scope the person has
 * taken a decision about. A scope with NO row follows whatever level the
 * endpoint declares — which the client is never told. So a rowless scope is
 * not "off": it is *undecided*, and a switch drawn in the off position would
 * be a confident lie about a security setting.
 *
 * That is why each row is a two-option choice with NO selection until a
 * decision exists, and the line beside it says the scope follows the app's
 * default. Once a choice is made the row carries it. The alternative —
 * inventing a default so a `Switch` has something to render — is the class of
 * defect this whole wave exists to remove.
 *
 * ## Switching a scope OFF is itself protected, and it says so up front
 *
 * `PUT /verification/preferences/` is asymmetric on purpose: enabling applies
 * immediately, disabling answers the 403 verification envelope. The pair's
 * runtime already turns that into the app-root `<VerificationChallenge/>`
 * and retries the request transparently, so this screen needs no error
 * branch for it — but a person deserves to know *before* they press, not
 * after a dialog they did not expect. The note sits beside the controls.
 *
 * ## Which scopes appear
 *
 * The union of `scopes` (default: `verification.settings`, the one scope
 * stapel-auth protects on its own account) and every scope the server sent a
 * row for. A host that protects `wallet.withdraw` passes it in and the person
 * can decide about it here; nothing needs a fork.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Radio, Typography, theme as antdTheme } from "antd";
import { fontSize } from "@stapel/tokens";
import { loadStateFromQuery, useT } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  LoadBoundary,
} from "@stapel/tokens-antd/skin";
import type { VerificationPreferences as PreferencesResponse } from "../../api/types.js";
import { useVerificationPreferences } from "../../model/queries.js";
import { useSetVerificationPreference } from "../../model/mutations.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityEmptyIcon } from "./icons.js";
import { SecurityCard, SecurityList, SecurityListRow } from "./SecurityListRow.js";

/**
 * The one scope stapel-auth protects about itself: changing security settings
 * (passwords, passkeys, two-factor — and this page). Every other scope is the
 * host's, so the host names them.
 */
export const SETTINGS_SCOPE = "verification.settings";

/** A row's decision, or `undefined` while the scope is undecided. */
type Decision = "on" | "off" | undefined;

/**
 * `"wallet.withdraw"` → `"Wallet withdraw"`. Best-effort, and deliberately
 * NOT a translation: the set of step-up scopes is open-ended and belongs to
 * whichever module declared it, so inventing friendly prose about someone
 * else's security setting would be worse than making the identifier
 * readable. The dotted token itself is never what a person reads (visual
 * pass C3) — the audit log's event types take the same treatment.
 */
function humanizeScope(scope: string): string {
  const spaced = scope.replace(/[._]/g, " ").trim();
  if (spaced.length === 0) return scope;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Human name + supporting line for a scope. Scopes this pair does not own
 *  render their humanized identifier — see {@link humanizeScope}. */
function scopeCopy(scope: string): {
  readonly titleKey: string;
  readonly hintKey?: string;
} {
  if (scope === SETTINGS_SCOPE) {
    return {
      titleKey: AUTH_I18N_KEYS.secVerifyScopeSettings,
      hintKey: AUTH_I18N_KEYS.secVerifyScopeSettingsHint,
    };
  }
  return { titleKey: AUTH_I18N_KEYS.secVerifyScopeOther };
}

function ScopeRow(props: {
  scope: string;
  decision: Decision;
  pending: boolean;
  onChoose: (enabled: boolean) => void;
}): ReactElement {
  const t = useT();
  const copy = scopeCopy(props.scope);
  const title = t(copy.titleKey, { scope: humanizeScope(props.scope) });
  return (
    <SecurityListRow
      data-testid="verify-scope-row"
      title={title}
      meta={
        <>
          {copy.hintKey !== undefined && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: fontSize.xs.fontSize }}
            >
              {t(copy.hintKey)}
            </Typography.Text>
          )}
          {props.decision === undefined && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: fontSize.xs.fontSize }}
              data-testid="verify-scope-default"
            >
              {t(AUTH_I18N_KEYS.secVerifyDefault)}
            </Typography.Text>
          )}
        </>
      }
      actions={
        <Radio.Group
          // No `value` while undecided: antd renders nothing selected, which
          // is the truth. A `Switch` cannot say this.
          {...(props.decision !== undefined ? { value: props.decision } : {})}
          optionType="button"
          disabled={props.pending}
          aria-label={t(AUTH_I18N_KEYS.secVerifyToggleLabel, { scope: title })}
          data-testid={`verify-scope-${props.scope}`}
          onChange={(e) => props.onChoose(e.target.value === "on")}
          options={[
            { label: t(AUTH_I18N_KEYS.secVerifyOn), value: "on" },
            { label: t(AUTH_I18N_KEYS.secVerifyOff), value: "off" },
          ]}
        />
      }
    />
  );
}

export interface VerificationPreferencesProps {
  /**
   * Scopes to offer a decision about even when the server has no row for them
   * yet. Defaults to the one scope stapel-auth protects itself
   * ({@link SETTINGS_SCOPE}); a host adds its own.
   */
  readonly scopes?: readonly string[];
}

/** Step-up verification preferences: one decision per scope, sparse by
 *  contract, with the cost of switching one off stated before it is pressed. */
export function VerificationPreferences(
  props: VerificationPreferencesProps = {}
): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const query = useVerificationPreferences();
  const save = useSetVerificationPreference();
  // Which scope is mid-flight — the row disables its own control, never the
  // whole list, so a slow save does not freeze a screen the person is reading.
  const [pendingScope, setPendingScope] = useState<string | null>(null);

  const declared = props.scopes ?? [SETTINGS_SCOPE];
  const state = loadStateFromQuery(query);

  return (
    <SecurityCard
      title={t(AUTH_I18N_KEYS.secVerifyTitle)}
      data-testid="verification-preferences"
    >
        <Flex vertical gap="middle" style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            {t(AUTH_I18N_KEYS.secVerifySubtitle)}
          </Typography.Text>
          {/* Beside the controls, before the press — not raised by the 403
              that follows it. */}
          <Typography.Text type="secondary" data-testid="verify-disable-note">
            {t(AUTH_I18N_KEYS.secVerifyDisableNote)}
          </Typography.Text>

          <LoadBoundary
            state={state}
            testId="verify-prefs"
            onRetry={() => void query.refetch()}
          >
            {(data: PreferencesResponse) => {
              const rows = data.preferences;
              const scopes = [
                ...declared,
                ...rows.map((r) => r.scope).filter((s) => !declared.includes(s)),
              ];
              if (scopes.length === 0) {
                return (
                  <EmptyState
                    icon={<SecurityEmptyIcon />}
                    title={t(AUTH_I18N_KEYS.secVerifyEmpty)}
                    hint={t(AUTH_I18N_KEYS.secVerifyEmptyHint)}
                  />
                );
              }
              return (
                <SecurityList ruleColor={token.colorBorderSecondary}>
                  {scopes.map((scope) => {
                    const row = rows.find((r) => r.scope === scope);
                    return (
                      <ScopeRow
                        key={scope}
                        scope={scope}
                        decision={
                          row === undefined ? undefined : row.enabled ? "on" : "off"
                        }
                        pending={save.isPending && pendingScope === scope}
                        onChoose={(enabled) => {
                          setPendingScope(scope);
                          save.mutate(
                            { scope, enabled },
                            { onSettled: () => setPendingScope(null) }
                          );
                        }}
                      />
                    );
                  })}
                </SecurityList>
              );
            }}
          </LoadBoundary>

          <ErrorAlert thrown={save.error} />
        </Flex>
    </SecurityCard>
  );
}
