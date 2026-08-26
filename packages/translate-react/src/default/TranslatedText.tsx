/**
 * `<TranslatedText/>` — a piece of somebody else's writing, optionally in the
 * reader's language.
 *
 * Six of these on a results page produce ONE request: each one asks the
 * runtime's batcher, and everything asked for in a tick goes out together (see
 * `model/textBatch.ts`). The caller writes the obvious thing — a component
 * beside each title — and pays for one provider call.
 *
 * ── What the secondary line says, and why it says it ───────────────────────
 *
 * A machine translation that looks like the original is a lie of omission: a
 * reader deciding whether to buy something needs to know they are reading an
 * approximation, in which language it was written, and — when the answer came
 * from a cache — that it was not even produced for them. All three are one
 * quiet line under the text, in the same spirit as a converted price saying
 * "approx.". `data-stapel-translate="cached|fresh"` carries the same fact for
 * a test.
 */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { TRANSLATE_I18N_KEYS } from "../i18n/keys.js";
import { languageKey } from "../i18n/languages.js";
import { useTranslateText } from "../headless/useTranslateText.js";
import { TranslateButton } from "./TranslateButton.js";
import type { ThemeModeProp } from "./types.js";

export interface TranslatedTextProps extends ThemeModeProp {
  /** The text as its author wrote it. */
  readonly text: string;
  /** The language it is written in, when the caller knows it. */
  readonly sourceLang?: string;
  /** Domain hint that rides into the prompt ("a car listing title"). */
  readonly context?: string;
  /** Translate into this language instead of the reader's own. */
  readonly target?: string;
  /** Translate without waiting to be asked (a feed the viewer set to auto). */
  readonly auto?: boolean;
  /** Render the translate control beside the text. Default: true. */
  readonly showControl?: boolean;
  readonly "data-testid"?: string;
}

export function TranslatedText(props: TranslatedTextProps): ReactElement {
  const t = useT();
  const bag = useTranslateText(props.text, {
    ...(props.sourceLang !== undefined ? { sourceLang: props.sourceLang } : {}),
    ...(props.context !== undefined ? { context: props.context } : {}),
    ...(props.target !== undefined ? { target: props.target } : {}),
    ...(props.auto !== undefined ? { auto: props.auto } : {}),
  });

  const showingTranslation = bag.translations !== null && !bag.showingOriginal;
  const sourceName =
    bag.sourceLanguage !== null && bag.sourceLanguage.length > 0
      ? t(languageKey(bag.sourceLanguage))
      : "";

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <Flex vertical gap={spacing[1]} align="flex-start">
        <Typography.Paragraph
          style={{ marginBottom: 0 }}
          data-stapel-translate={
            showingTranslation ? (bag.cached ? "cached" : "fresh") : "original"
          }
          data-testid="translate-text"
        >
          {bag.text}
        </Typography.Paragraph>
        {showingTranslation ? (
          <Typography.Text type="secondary" data-testid="translate-text-note">
            {`${t(TRANSLATE_I18N_KEYS.buttonTranslatedFrom, {
              lang: sourceName,
            })} · ${t(TRANSLATE_I18N_KEYS.buttonMachine)}${
              bag.cached ? ` · ${t(TRANSLATE_I18N_KEYS.buttonCached)}` : ""
            }`}
          </Typography.Text>
        ) : null}
        {props.showControl === false ? null : <TranslateButton bag={bag} />}
      </Flex>
    </SkinTheme>
  );
}
