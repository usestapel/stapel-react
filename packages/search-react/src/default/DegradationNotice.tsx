/**
 * `degraded[]`, on the screen.
 *
 * The whole point of the backend declaring its degradations per query is that
 * a client can tell the person. A banner is not decoration here: "counts are
 * approximate" and "subcategories may be missing" change what the page MEANS,
 * and the spec calls swallowing them the same class of defect as `data ?? []`.
 *
 * An `unknown` degradation still renders — with the raw literal, because a
 * build that predates a new limitation should say "the engine reported
 * something we have no wording for: X", not nothing at all.
 *
 * ── Two deliberate ways NOT to shout ───────────────────────────────────────
 *
 * 1. **`exact_total` alone never raises a banner.** It is a count NUANCE, not
 *    a failed search: the rows are right, and the single consequence — that
 *    the total is a floor — is already spoken by the count as "N+". A warning
 *    box over a perfectly good result page teaches the reader that the page
 *    is broken, and a banner that cries wolf on every landing page is a
 *    banner nobody reads on the day `category_rollup` appears in it. Beside
 *    any other degradation it renders normally, because the list is then
 *    describing an answer that really is degraded. See
 *    {@link isCountNuanceOnly}.
 * 2. **`variant`.** A catalogue page wants the banner; a landing page that
 *    shows six cards under a hero has no room for a warning box and passes
 *    `"inline"` (one quiet line) or `"off"`. `"off"` is a decision the
 *    CONTAINER makes about ITS surface — the notice stays the default, and
 *    nothing here silences a degradation for everyone.
 */
import type { ReactElement } from "react";
import { Alert, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import type { SearchDegradation } from "../api/types.js";
import { isCountNuanceOnly } from "../state/degradations.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/**
 * How loudly a surface says what the engine could not do.
 *
 * - `"banner"` (default) — an antd warning `Alert` with one line per item.
 * - `"inline"` — the same sentences as quiet secondary text, no box.
 * - `"off"` — nothing. For a surface where the notice does not belong at all;
 *   the container that turns it off owns saying so somewhere else.
 */
export type DegradationNoticeVariant = "banner" | "inline" | "off";

export interface DegradationNoticeProps {
  readonly degradations: readonly SearchDegradation[];
  readonly variant?: DegradationNoticeVariant;
}

export function DegradationNotice(
  props: DegradationNoticeProps
): ReactElement | null {
  const t = useT();
  const variant: DegradationNoticeVariant = props.variant ?? "banner";
  if (variant === "off") return null;
  if (props.degradations.length === 0) return null;
  // A count nuance is not a degraded search — the count already says "N+".
  if (isCountNuanceOnly(props.degradations)) return null;

  const lines = props.degradations.map((degradation) => (
    <li key={degradation.raw} data-degradation={degradation.raw}>
      <Typography.Text type="secondary">
        {t(degradation.messageKey, {
          scorer: degradation.scorer ?? "",
          raw: degradation.raw,
        })}
      </Typography.Text>
    </li>
  ));

  if (variant === "inline") {
    return (
      <Flex vertical gap={2} data-testid="search-degraded" data-variant="inline">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t(SEARCH_I18N_KEYS.degradedTitle)}
        </Typography.Text>
        <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 12 }}>
          {lines}
        </ul>
      </Flex>
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      data-testid="search-degraded"
      data-variant="banner"
      message={t(SEARCH_I18N_KEYS.degradedTitle)}
      description={
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>{lines}</ul>
      }
    />
  );
}
