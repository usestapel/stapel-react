/**
 * `<TranslationStatus/>` — where the copy on this screen came from.
 *
 * A UI catalogue arriving over the network is invisible when it works and
 * indistinguishable from a bug when it does not: an operator looking at a
 * half-English Spanish page cannot tell a missing key from a failed download.
 * This chip is the difference — the revision in effect and how many texts it
 * carries, or the sentence naming which rung of the loader's fallback ladder
 * answered.
 *
 * It is small on purpose. A settings screen shows it under the switcher; a
 * host may put it in a footer. It reads the loader's published status, so it
 * costs no request of its own.
 */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { TRANSLATE_I18N_KEYS } from "../i18n/keys.js";
import { useRemoteLocale } from "../headless/useRemoteLocale.js";
import type { ThemeModeProp } from "./types.js";

export interface TranslationStatusProps extends ThemeModeProp {
  /** Which locale to report on. Defaults to the one in effect. */
  readonly locale?: string;
  readonly "data-testid"?: string;
}

export function TranslationStatus(props: TranslationStatusProps): ReactElement {
  const t = useT();
  const state = useRemoteLocale(props.locale);

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <LoadBoundary
        state={state}
        loading={
          <Typography.Text type="secondary" data-stapel-load-state="loading">
            {t(TRANSLATE_I18N_KEYS.statusLoading)}
          </Typography.Text>
        }
        failed={(error) => (
          <ErrorAlert
            thrown={error}
            variant="inline"
            message={t(TRANSLATE_I18N_KEYS.statusFallback)}
            testId="translate-status-failed"
          />
        )}
        testId="translate-status"
      >
        {(status) => (
          <Flex vertical gap={spacing[1]}>
            <Typography.Text
              type="secondary"
              data-stapel-translate={status.source}
            >
              {`${status.locale.toUpperCase()} · ${t(
                TRANSLATE_I18N_KEYS.statusRevision,
                { revision: status.revision ?? 0, keys: status.keys }
              )}`}
            </Typography.Text>
            {status.failed ? (
              <Typography.Text type="warning" data-stapel-translate="degraded">
                {t(TRANSLATE_I18N_KEYS.statusOffline)}
              </Typography.Text>
            ) : null}
          </Flex>
        )}
      </LoadBoundary>
    </SkinTheme>
  );
}
