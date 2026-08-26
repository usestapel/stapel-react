/**
 * `<ReportButton>` — the one control other pairs embed.
 *
 * This is a SLOT, not a screen: a listing card, a review, a chat message menu
 * and a profile all mount it beside their own actions, which is why it has no
 * nav entry and why it takes the target as props rather than reading a route.
 *
 * ```tsx
 * <ReportButton targetType="listing" targetKey={String(listing.id)} />
 * ```
 *
 * ── A visitor gets the same button ────────────────────────────────────────
 *
 * It opens the sheet, which shows the rules and the sign-in door. Hiding the
 * control from a signed-out person hides the FEATURE from them: they never
 * learn the platform accepts complaints at all, which is the opposite of what
 * the notice mechanism is for.
 *
 * The sheet is only mounted once the button has been pressed. `GET policy` is
 * a network read, and a listing page carrying twenty of these must not open
 * twenty of them.
 */
import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import { Button } from "antd";
import { useT } from "@stapel/core";
import type { SignInCtaProp } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { FlagIcon } from "./icons.js";
import { ReportSheet } from "./ReportSheet.js";
import type { ThemeModeProp } from "./types.js";

export interface ReportButtonProps extends ThemeModeProp, SignInCtaProp {
  readonly targetType: string;
  readonly targetKey: string;
  readonly scopeKey?: string;
  /** Icon only, for a card's action row where the word does not fit. The
   * accessible name stays — it moves from the label to `aria-label`. */
  readonly compact?: boolean;
  readonly size?: "small" | "middle" | "large";
  readonly block?: boolean;
  readonly "data-testid"?: string;
}

export function ReportButton(props: ReportButtonProps): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "moderation-report-button";
  const [open, setOpen] = useState(false);
  // Mounted lazily and then kept, so closing the sheet does not throw away a
  // half-written description the person may be coming back to.
  const [everOpened, setEverOpened] = useState(false);

  const openSheet = useCallback((): void => {
    setEverOpened(true);
    setOpen(true);
  }, []);
  const closeSheet = useCallback((): void => {
    setOpen(false);
  }, []);

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Button
        icon={<FlagIcon />}
        aria-label={t(MODERATION_I18N_KEYS.reportButtonLabel)}
        data-testid={testId}
        data-analytics="none"
        data-analytics-reason="opens the report sheet; the submission inside it steps the tracked moderation.report flow"
        onClick={openSheet}
        {...(props.size !== undefined ? { size: props.size } : {})}
        {...(props.block === true ? { block: true } : {})}
      >
        {props.compact === true ? null : t(MODERATION_I18N_KEYS.reportButton)}
      </Button>
      {everOpened ? (
        <ReportSheet
          open={open}
          onClose={closeSheet}
          targetType={props.targetType}
          targetKey={props.targetKey}
          data-testid={`${testId}-sheet`}
          {...(props.scopeKey !== undefined ? { scopeKey: props.scopeKey } : {})}
          {...(props.signIn !== undefined ? { signIn: props.signIn } : {})}
          {...(props.mode !== undefined ? { mode: props.mode } : {})}
        />
      ) : null}
    </SkinTheme>
  );
}
