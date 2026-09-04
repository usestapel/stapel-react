import type { ReactElement } from "react";
import { Skeleton, Space, Typography, theme as antdTheme } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { CURRENCIES_I18N_KEYS } from "../i18n/keys.js";
import { usePrice } from "../headless/usePrice.js";
import type { ThemeModeProp } from "./types.js";

export interface PriceProps extends ThemeModeProp {
  /** The amount as the wire spells it — a decimal string. */
  readonly amount: string;
  /** The currency the amount is IN. */
  readonly currency: string;
  /** Override the viewer's chosen display currency. */
  readonly displayCurrency?: string;
  /** Draw the converted estimate under the price. Default `true`. */
  readonly showConverted?: boolean;
  /** Also draw the rate the estimate used, as visible text. Default `false` —
   * on a card it is noise; on a detail page it is the answer to "converted at
   * what?". */
  readonly showRate?: boolean;
  readonly "data-testid"?: string;
}

/**
 * A price, in the currency it is quoted in — with an optional estimate under
 * it in the currency the viewer chose.
 *
 * ── What this component refuses to do ──────────────────────────────────────
 *
 * It never shows the converted number ALONE. The rate has no timestamp on this
 * contract (BACKEND-GAP C-2), so an estimate is an estimate; replacing the
 * seller's actual number with one would put a price on screen that nobody has
 * agreed to. The original renders on the first frame, before the catalogue has
 * even been asked.
 *
 * It also carries no `title` attribute and no tooltip. The rate is either
 * visible text (`showRate`) or absent — a hover explanation does not exist on
 * a phone, which is where most of these are read.
 */
export function Price(props: PriceProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const showConverted = props.showConverted ?? true;
  const price = usePrice({
    amount: props.amount,
    currency: props.currency,
    ...(props.displayCurrency !== undefined
      ? { displayCurrency: props.displayCurrency }
      : {}),
  });

  const secondary = (): ReactElement | null => {
    if (!showConverted || price.currency === price.displayCurrency) return null;
    if (price.state === "loading") {
      // Only the estimate waits; the price above it is already on screen.
      return (
        <Skeleton.Input active size="small" style={{ width: token.controlHeight * 3 }} />
      );
    }
    if (price.state === "unavailable") {
      return (
        // Not the same muted grey as a successful estimate: an absent
        // conversion and a conversion are different facts and must not read
        // as the same line at the same weight.
        <Typography.Text
          type="warning"
          data-stapel-price="unavailable"
          style={{ fontSize: token.fontSizeSM }}
        >
          {t(CURRENCIES_I18N_KEYS.priceUnavailable)}
        </Typography.Text>
      );
    }
    if (price.converted === undefined) return null;
    return (
      <Typography.Text type="secondary" data-stapel-price="converted">
        {t(CURRENCIES_I18N_KEYS.priceApprox, { value: price.converted })}
      </Typography.Text>
    );
  };

  const rateLine =
    props.showRate === true && price.rate !== undefined ? (
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {t(CURRENCIES_I18N_KEYS.priceRate, {
          from: price.currency,
          to: price.displayCurrency,
          rate: price.rate,
        })}
      </Typography.Text>
    ) : null;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <Space orientation="vertical" size={0} data-stapel-price-state={price.state}>
        {/* A price is display type. Set at body size it competed with the
            heading above it and read as one more line of prose. */}
        <Typography.Text
          strong
          data-stapel-price="original"
          style={{ fontSize: token.fontSizeHeading4, lineHeight: 1.2 }}
        >
          {price.original}
        </Typography.Text>
        {secondary()}
        {rateLine}
      </Space>
    </SkinTheme>
  );
}
