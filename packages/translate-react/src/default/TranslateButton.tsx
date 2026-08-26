/**
 * `<TranslateButton/>` — "show me this in my language", beside the thing it
 * would translate.
 *
 * ── It is absent, not greyed, when the site cannot translate ───────────────
 *
 * Content translation is a deployment capability: an LLM provider has to be
 * configured, and every miss spends money. Where it is off, this component
 * renders `null`. A disabled translate button that can never become enabled is
 * the dead-control defect — it teaches a person to expect a feature this
 * product does not have.
 *
 * ── Where it IS available, every refusal has a sentence ────────────────────
 *
 * The gate carries its reason (already in your language, over the length
 * ceiling, sign in first) and `GatedButton` prints it beside the control with
 * `aria-describedby` wired. A failed call is folded by CODE, so 429 says "wait
 * a moment" with no retry button that would only be refused again, while a 502
 * says the provider is down and offers one.
 *
 * ── The state after success is a toggle, not a dead end ────────────────────
 *
 * A machine translation is an estimate. A reader who finds it strange must be
 * able to get back to what the seller actually wrote, so the button becomes
 * "Show original" rather than disappearing.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, List } from "antd";
import { useT } from "@stapel/core";
import {
  ErrorAlert,
  GatedButton,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { TRANSLATE_I18N_KEYS } from "../i18n/keys.js";
import { useTranslateRuntime } from "../model/context.js";
import type { TranslateTextBag } from "../headless/useTranslateText.js";
import { TranslateIcon } from "./icons.js";
import type { ThemeModeProp } from "./types.js";

export interface TranslateButtonProps extends ThemeModeProp {
  /** The bag from `useTranslateText` — the button never opens its own request. */
  readonly bag: TranslateTextBag;
  /** Offer a target-language picker. Off by default: the viewer's own language
   * is the answer in the overwhelming majority of cases, and a picker beside
   * every paragraph is a screen full of choices nobody asked for. */
  readonly allowTarget?: boolean;
  readonly "data-testid"?: string;
}

export function TranslateButton(
  props: TranslateButtonProps
): ReactElement | null {
  const t = useT();
  const runtime = useTranslateRuntime();
  const { bag } = props;
  const [picking, setPicking] = useState(false);

  if (!bag.available) return null;

  const translated = bag.translations !== null;
  const label = translated
    ? bag.showingOriginal
      ? t(TRANSLATE_I18N_KEYS.buttonShowTranslation)
      : t(TRANSLATE_I18N_KEYS.buttonShowOriginal)
    : bag.status === "translating"
      ? t(TRANSLATE_I18N_KEYS.buttonTranslating)
      : t(TRANSLATE_I18N_KEYS.buttonLabel);

  const action = translated ? (
    <Button
      size="small"
      onClick={bag.toggle}
      data-analytics="none"
      data-analytics-reason="switches between two texts already in hand; the request was tracked in useTranslateText"
      data-testid="translate-button-toggle"
    >
      {label}
    </Button>
  ) : (
    <GatedButton
      gate={bag.translate}
      size="small"
      loading={bag.status === "translating"}
      onClick={bag.run}
      icon={<TranslateIcon />}
      data-analytics="none"
      data-analytics-reason="the request is tracked as translate.content.requested in useTranslateText"
      testId="translate-button"
    >
      {label}
    </GatedButton>
  );

  const refusal =
    bag.refusal !== null ? (
      <ErrorAlert
        variant="inline"
        message={t(bag.refusal.key, bag.refusal.params)}
        {...(bag.refusal.retryable
          ? { onRetry: bag.run, retryLabel: t(TRANSLATE_I18N_KEYS.buttonRetry) }
          : {})}
        testId="translate-button-failed"
      />
    ) : null;

  const target =
    props.allowTarget === true ? (
      <>
        <Button
          size="small"
          type="link"
          onClick={() => {
            setPicking(true);
          }}
          data-analytics="none"
          data-analytics-reason="opens the target picker; the request itself is tracked in useTranslateText"
          data-testid="translate-button-target"
        >
          {`${t(TRANSLATE_I18N_KEYS.dialogTarget)} ${bag.target.toUpperCase()}`}
        </Button>
        <SkinDialog
          open={picking}
          onClose={() => {
            setPicking(false);
          }}
          title={t(TRANSLATE_I18N_KEYS.dialogTarget)}
          dismissLabel={t(TRANSLATE_I18N_KEYS.dialogDismiss)}
          data-testid="translate-button-target-sheet"
        >
          <List
            dataSource={[...runtime.languages]}
            renderItem={(option) => (
              <List.Item
                onClick={() => {
                  bag.setTarget(option.code);
                  setPicking(false);
                }}
                aria-current={option.code === bag.target}
                style={{ cursor: "pointer" }}
                data-analytics="none"
                data-analytics-reason="chooses a target; the request is tracked once, in useTranslateText"
              >
                {t(option.labelKey)}
              </List.Item>
            )}
          />
        </SkinDialog>
      </>
    ) : null;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <Flex vertical gap={spacing[1]} align="flex-start">
        <Flex gap={spacing[2]} align="center" wrap>
          {action}
          {target}
        </Flex>
        {refusal}
      </Flex>
    </SkinTheme>
  );
}
