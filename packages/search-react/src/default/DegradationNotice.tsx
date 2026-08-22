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
 */
import type { ReactElement } from "react";
import { Alert, Typography } from "antd";
import { useT } from "@stapel/core";
import type { SearchDegradation } from "../api/types.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

export interface DegradationNoticeProps {
  readonly degradations: readonly SearchDegradation[];
}

export function DegradationNotice(
  props: DegradationNoticeProps
): ReactElement | null {
  const t = useT();
  if (props.degradations.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="search-degraded"
      message={t(SEARCH_I18N_KEYS.degradedTitle)}
      description={
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          {props.degradations.map((degradation) => (
            <li key={degradation.raw} data-degradation={degradation.raw}>
              <Typography.Text type="secondary">
                {t(degradation.messageKey, {
                  scorer: degradation.scorer ?? "",
                  raw: degradation.raw,
                })}
              </Typography.Text>
            </li>
          ))}
        </ul>
      }
    />
  );
}
