import type { ReactElement } from "react";
import { Button, Space, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { useAddToCartButton } from "../headless/AddToCartButton.js";
import type { AddToCartProps } from "../headless/AddToCartButton.js";
import { ORDERS_I18N_KEYS } from "../i18n/keys.js";
import { ORDERS_TESTIDS } from "../testids.js";
import { DEFAULT_CART_HREF, linkProps } from "./navigate.js";
import type { NavigateProp, ThemeModeProp } from "./types.js";

export interface AddToCartButtonSkinProps
  extends AddToCartProps,
    NavigateProp,
    ThemeModeProp {
  /** Where "Go to cart" leads. Default `/cart`. */
  readonly cartHref?: string;
}

/**
 * The antd add-to-cart control. Same contract as the headless one: it always
 * renders `data-testid="add-to-cart"`, owns its request, and after a success
 * shows the line count and "Go to cart".
 */
export function AddToCartButton(props: AddToCartButtonSkinProps): ReactElement {
  const t = useT();
  const bag = useAddToCartButton(props);
  const cartHref = props.cartHref ?? DEFAULT_CART_HREF;
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="bare"
      style={{ display: "inline-flex" }}
    >
      <Space wrap>
        <Button
          type="primary"
          data-testid={ORDERS_TESTIDS.addToCart}
          data-analytics="none"
          data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime and no flow machine for a single POST"
          disabled={props.disabled === true}
          loading={bag.pending}
          onClick={bag.add}
        >
          {bag.pending ? t(ORDERS_I18N_KEYS.addAdding) : t(ORDERS_I18N_KEYS.addLabel)}
        </Button>
        {bag.added && (
          <Space role="status">
            <Typography.Text type="secondary">
              {t(ORDERS_I18N_KEYS.addInCart, { count: bag.lineCount ?? 0 })}
            </Typography.Text>
            <Button
              type="link"
              data-testid={ORDERS_TESTIDS.goToCart}
              data-analytics="none"
              data-analytics-reason="navigation — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
              {...linkProps(cartHref, props.onNavigate)}
            >
              {t(ORDERS_I18N_KEYS.addGoToCart)}
            </Button>
          </Space>
        )}
        {bag.error !== null && (
          <Typography.Text type="danger" role="alert">
            {t(bag.error.code || ORDERS_I18N_KEYS.unknownError)}
          </Typography.Text>
        )}
      </Space>
    </SkinTheme>
  );
}
