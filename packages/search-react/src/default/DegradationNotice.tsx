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
 * 1. **A degradation addressed to the OPERATOR never reaches the reader.**
 *    `typo_tolerance` and `phrase_synonyms` both say, in the shipped ru copy,
 *    "the search engine in use cannot do this" — a sentence about which
 *    engine somebody licensed, printed at a person trying to buy a phone. It
 *    is the same sentence on every query forever, which is what makes it
 *    invisible by the day `category_rollup` shows up in the same box.
 *    `exact_total` joins them: the count already says "N+".
 *
 *    Measured live on a classified board: a full-screen yellow "synonyms
 *    were not substituted" between the sort control and the first card, on every
 *    query, for every buyer. Note what the fix is NOT — the string was not
 *    deleted and the kind was not special-cased. `readerFacing` names the
 *    *audience*, so the next engine-capability literal is filtered by the
 *    same rule instead of growing its own copy of this comment.
 * 2. **`variant`.** A catalogue page wants the banner; a landing page that
 *    shows six cards under a hero has no room for a warning box and passes
 *    `"inline"` (one quiet line) or `"off"`. `"debug"` is the operator's
 *    view: everything, unfiltered, for a status page or a support tool.
 *    `"off"` is a decision the CONTAINER makes about ITS surface — the
 *    notice stays the default, and nothing here silences a reader-facing
 *    degradation for everyone.
 */
import type { ReactElement } from "react";
import { Alert, Flex, Typography } from "antd";
import { fontSize, spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import type { SearchDegradation } from "../api/types.js";
import { readerFacing } from "../state/degradations.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/**
 * How loudly a surface says what the engine could not do.
 *
 * - `"banner"` (default) — an antd warning `Alert` with one line per item.
 * - `"inline"` — the same sentences as quiet secondary text, no box.
 * - `"debug"` — every degradation including the operator's, for a status page
 *   or a support tool. The one variant that does not filter by audience.
 * - `"off"` — nothing. For a surface where the notice does not belong at all;
 *   the container that turns it off owns saying so somewhere else.
 */
export type DegradationNoticeVariant = "banner" | "inline" | "debug" | "off";

export interface DegradationNoticeProps {
  readonly degradations: readonly SearchDegradation[];
  readonly variant?: DegradationNoticeVariant;
  /**
   * Names a `scorer:` degradation's slug, when something on the page knows
   * one. `<SearchResultsPane>` passes the ranking disclosure's own names
   * (`useScorerNames`); with no answer the slug is printed, which is what a
   * registry identifier is worth on its own.
   */
  readonly scorerName?: (slug: string) => string | undefined;
}

export function DegradationNotice(
  props: DegradationNoticeProps
): ReactElement | null {
  const t = useT();
  const variant: DegradationNoticeVariant = props.variant ?? "banner";
  if (variant === "off") return null;
  // Everything, or only what this page's reader can act on.
  const degradations =
    variant === "debug" ? props.degradations : readerFacing(props.degradations);
  if (degradations.length === 0) return null;

  const say = (degradation: SearchDegradation): string => {
    const slug = degradation.scorer;
    return t(degradation.messageKey, {
      scorer:
        slug === undefined
          ? ""
          : (props.scorerName?.(slug) ?? slug),
      raw: degradation.raw,
    });
  };

  // NOT `type="secondary"` in the banner: antd paints a warning Alert in the
  // theme's warning tint, and grey body text on it measured under 3:1 in the
  // visual pass. Inside a coloured box the readable colour is the box's own
  // text colour, which is what a plain `<Typography.Text>` inherits.
  const lines = degradations.map((degradation) => (
    <li key={degradation.raw} data-degradation={degradation.raw}>
      <Typography.Text>{say(degradation)}</Typography.Text>
    </li>
  ));

  if (variant === "inline") {
    return (
      <Flex vertical gap={spacing[1]} data-testid="search-degraded" data-variant="inline">
        <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
          {t(SEARCH_I18N_KEYS.degradedTitle)}
        </Typography.Text>
        <ul style={{ margin: 0, paddingInlineStart: spacing[5], fontSize: fontSize.xs.fontSize }}>
          {degradations.map((degradation) => (
            <li key={degradation.raw} data-degradation={degradation.raw}>
              <Typography.Text type="secondary">{say(degradation)}</Typography.Text>
            </li>
          ))}
        </ul>
      </Flex>
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      data-testid="search-degraded"
      data-variant={variant === "debug" ? "debug" : "banner"}
      title={t(SEARCH_I18N_KEYS.degradedTitle)}
      description={
        <ul style={{ margin: 0, paddingInlineStart: spacing[5] }}>{lines}</ul>
      }
    />
  );
}
