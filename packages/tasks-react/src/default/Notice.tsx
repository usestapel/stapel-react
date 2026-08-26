/**
 * A NOTICE — the thing that is neither an error nor an empty state.
 *
 * Three of this pair's messages are news rather than faults: the board was cut
 * short by the server's cap, a move was accepted but needs approval, and a move
 * landed. `ErrorAlert` would paint them as failures, `EmptyState` is for an
 * absence, and antd's `<Alert>` is mid-rename between majors (`message` →
 * `title`), which would make this file the one place in the pair that has to
 * know which antd a host installed. So the notice is drawn here, from the
 * theme's own semantic tokens: no colour literal, correct in both themes, and
 * one component instead of a version branch.
 *
 * Filed in `SCRATCH/wave-b/REQUESTS-tasks-react.md` as a candidate for
 * `@stapel/tokens-antd/skin` — the substrate has the failure, the emptiness and
 * the load, and this is the fourth arm every screen eventually needs.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Flex, Typography, theme } from "antd";
import { useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import { CloseGlyph } from "./icons.js";

export type NoticeTone = "info" | "warning" | "success";

export interface NoticeProps {
  readonly tone: NoticeTone;
  readonly children: ReactNode;
  /** Present a dismiss control. Omitted, the notice stays until its cause does. */
  readonly onDismiss?: () => void;
  readonly testId?: string;
}

export function Notice(props: NoticeProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const palette: Record<NoticeTone, { readonly bg: string; readonly border: string }> =
    {
      info: { bg: token.colorInfoBg, border: token.colorInfoBorder },
      warning: { bg: token.colorWarningBg, border: token.colorWarningBorder },
      success: { bg: token.colorSuccessBg, border: token.colorSuccessBorder },
    };
  const tone = palette[props.tone];
  const style: CSSProperties = {
    background: tone.bg,
    border: `1px solid ${tone.border}`,
    borderRadius: radii.md,
    padding: spacing[2],
    color: token.colorText,
  };
  return (
    <div
      role="status"
      style={style}
      data-stapel-notice={props.tone}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    >
      <Flex align="center" justify="space-between" gap={spacing[2]}>
        <Typography.Text>{props.children}</Typography.Text>
        {props.onDismiss !== undefined ? (
          <Button
            type="text"
            size="small"
            onClick={props.onDismiss}
            aria-label={t(TASKS_I18N_KEYS.dialogDismiss)}
            data-analytics="none"
            data-analytics-reason="dismisses a notice about something already measured elsewhere"
          >
            <CloseGlyph />
          </Button>
        ) : null}
      </Flex>
    </div>
  );
}
