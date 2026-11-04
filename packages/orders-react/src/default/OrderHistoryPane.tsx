import type { ReactElement } from "react";
import { Button, Flex, Spin, Typography, theme as antdTheme } from "antd";
import { useFormat, useT } from "@stapel/core";
import { EmptyState, ErrorAlert, Page, StatusTag } from "@stapel/tokens-antd/skin";
import type { Order } from "../api/types.js";
import { ORDERS_I18N_KEYS } from "../i18n/keys.js";
import { ordersFromPages, useOrders } from "../model/queries.js";
import { orderStatusFamily, orderStatusKey } from "../model/status.js";
import { ORDERS_TESTIDS } from "../testids.js";
import { useMoney } from "./money.js";
import { defaultOrderHref, linkProps } from "./navigate.js";
import type { NavigateProp, ThemeModeProp } from "./types.js";

export interface OrderHistoryPaneProps extends ThemeModeProp, NavigateProp {
  /** Default `/orders/<id>` (`orders.detail`). */
  readonly orderHref?: (orderId: number) => string;
}

/** The person's orders (`orders.mine`), newest first, with "load more". */
export function OrderHistoryPane(props: OrderHistoryPaneProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const query = useOrders();
  const orders = ordersFromPages(query.data);
  const orderHref = props.orderHref ?? defaultOrderHref;

  let body: ReactElement;
  if (query.isPending) {
    body = <Spin />;
  } else if (query.isError || orders === undefined) {
    body = <ErrorAlert thrown={query.error} onRetry={() => void query.refetch()} />;
  } else if (orders.length === 0) {
    body = <EmptyState title={t(ORDERS_I18N_KEYS.historyEmpty)} />;
  } else {
    body = (
      <Flex vertical gap={token.paddingSM}>
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            href={orderHref(order.id)}
            onNavigate={props.onNavigate}
          />
        ))}
        {query.hasNextPage && (
          <Button
            block
            loading={query.isFetchingNextPage}
            data-testid={ORDERS_TESTIDS.ordersLoadMore}
            data-analytics="none"
            data-analytics-reason="paging further into a read — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            onClick={() => void query.fetchNextPage()}
          >
            {t(ORDERS_I18N_KEYS.historyLoadMore)}
          </Button>
        )}
      </Flex>
    );
  }

  return (
    <Page
      title={t(ORDERS_I18N_KEYS.historyTitle)}
      measure="reading"
      data-testid={ORDERS_TESTIDS.pageOrders}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      {body}
    </Page>
  );
}

function OrderRow(props: {
  readonly order: Order;
  readonly href: string;
  readonly onNavigate: ((href: string) => void) | undefined;
}): ReactElement {
  const t = useT();
  const format = useFormat();
  const money = useMoney();
  const { token } = antdTheme.useToken();
  const { order } = props;
  return (
    <a
      data-testid={ORDERS_TESTIDS.orderRow}
      data-order-id={order.id}
      {...linkProps(props.href, props.onNavigate)}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: token.paddingSM,
        padding: token.paddingSM,
        border: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        color: "inherit",
      }}
    >
      <Typography.Text strong>{order.number}</Typography.Text>
      <StatusTag status={orderStatusFamily(order.status)}>{t(orderStatusKey(order.status))}</StatusTag>
      <Typography.Text>{money(order.total, order.currency)}</Typography.Text>
      <Typography.Text type="secondary">{format.date(order.created_at) ?? ""}</Typography.Text>
    </a>
  );
}
