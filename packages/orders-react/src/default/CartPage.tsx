import type { ReactElement } from "react";
import { Button, Flex, InputNumber, Space, Spin, Typography, theme as antdTheme } from "antd";
import { useT } from "@stapel/core";
import { EmptyState, ErrorAlert, Page } from "@stapel/tokens-antd/skin";
import type { CartLine } from "../api/types.js";
import { ORDERS_I18N_KEYS } from "../i18n/keys.js";
import { useRemoveCartLine, useUpdateCartLine } from "../model/mutations.js";
import { useCart, useHasCartSession } from "../model/queries.js";
import { ORDERS_TESTIDS } from "../testids.js";
import { useMoney } from "./money.js";
import { DEFAULT_CHECKOUT_HREF, linkProps } from "./navigate.js";
import type { NavigateProp, ThemeModeProp } from "./types.js";

export interface CartPageProps extends ThemeModeProp, NavigateProp {
  /** Default `/checkout` (the `orders.checkout` entry). */
  readonly checkoutHref?: string;
}

/** The cart (`orders.cart`, `/cart`): one row per line, a total, checkout. */
export function CartPage(props: CartPageProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const cart = useCart();
  const hasSession = useHasCartSession();
  const money = useMoney();
  const checkoutHref = props.checkoutHref ?? DEFAULT_CHECKOUT_HREF;

  let body: ReactElement;
  if (!hasSession) {
    // No session owns a cart yet: it is empty, not loading.
    body = (
      <EmptyState testId={ORDERS_TESTIDS.cartEmpty} title={t(ORDERS_I18N_KEYS.cartEmpty)} />
    );
  } else if (cart.isPending) {
    body = <Spin />;
  } else if (cart.isError) {
    body = <ErrorAlert thrown={cart.error} onRetry={() => void cart.refetch()} />;
  } else if (cart.data.lines.length === 0) {
    body = (
      <EmptyState testId={ORDERS_TESTIDS.cartEmpty} title={t(ORDERS_I18N_KEYS.cartEmpty)} />
    );
  } else {
    const data = cart.data;
    body = (
      <Flex vertical gap={token.paddingLG}>
        {data.lines.map((line) => (
          <CartLineRow key={line.id} line={line} />
        ))}
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Typography.Text strong data-testid={ORDERS_TESTIDS.cartTotal}>
            {t(ORDERS_I18N_KEYS.cartTotal)}: {money(data.total, data.currency)}
          </Typography.Text>
          <Button
            type="primary"
            data-testid={ORDERS_TESTIDS.checkoutLink}
            data-analytics="none"
            data-analytics-reason="navigation — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            {...linkProps(checkoutHref, props.onNavigate)}
          >
            {t(ORDERS_I18N_KEYS.cartCheckout)}
          </Button>
        </Space>
      </Flex>
    );
  }

  return (
    <Page
      title={t(ORDERS_I18N_KEYS.cartTitle)}
      measure="reading"
      data-testid={ORDERS_TESTIDS.pageCart}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      {body}
    </Page>
  );
}

function CartLineRow(props: { readonly line: CartLine }): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const money = useMoney();
  const update = useUpdateCartLine();
  const remove = useRemoveCartLine();
  const { line } = props;
  const busy = update.isPending || remove.isPending;
  return (
    <div
      data-testid={ORDERS_TESTIDS.cartLine}
      data-line-id={line.id}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: token.paddingSM,
        paddingBlock: token.paddingSM,
        borderBottom: `${token.lineWidth}px ${token.lineType} ${token.colorSplit}`,
      }}
    >
      <Typography.Text strong style={{ flex: "1 1 12rem" }}>
        {line.url !== null ? <a href={line.url}>{line.title}</a> : line.title}
      </Typography.Text>
      <InputNumber
        aria-label={t(ORDERS_I18N_KEYS.cartQuantity)}
        min={1}
        value={line.quantity}
        disabled={busy}
        onChange={(value) => {
          if (typeof value === "number" && value !== line.quantity && value >= 1) {
            update.mutate({ lineId: line.id, quantity: value });
          }
        }}
      />
      <Typography.Text>{money(line.line_total, line.currency)}</Typography.Text>
      <Button
        type="link"
        danger
        disabled={busy}
        data-analytics="none"
        data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime"
        onClick={() => remove.mutate(line.id)}
      >
        {t(ORDERS_I18N_KEYS.cartRemove)}
      </Button>
    </div>
  );
}
