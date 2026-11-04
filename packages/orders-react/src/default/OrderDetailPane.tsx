import type { ReactElement } from "react";
import { Button, Descriptions, Flex, Space, Spin, Typography, theme as antdTheme } from "antd";
import { useFormat, useT } from "@stapel/core";
import { ErrorAlert, Page, StatusTag } from "@stapel/tokens-antd/skin";
import { ORDERS_I18N_KEYS } from "../i18n/keys.js";
import { useCancelOrder } from "../model/mutations.js";
import { useOrder } from "../model/queries.js";
import { orderStatusFamily, orderStatusKey } from "../model/status.js";
import { ORDERS_TESTIDS } from "../testids.js";
import { useMoney } from "./money.js";
import type { ThemeModeProp } from "./types.js";

export interface OrderDetailPaneProps extends ThemeModeProp {
  /** The `:id` route param of `orders.detail` (`/orders/:id`). */
  readonly id: string | number;
}

/** One order (`orders.detail`): lines, total, delivery, cancel while allowed. */
export function OrderDetailPane(props: OrderDetailPaneProps): ReactElement {
  const t = useT();
  const format = useFormat();
  const money = useMoney();
  const { token } = antdTheme.useToken();
  const orderId = Number(props.id);
  const query = useOrder(Number.isInteger(orderId) && orderId > 0 ? orderId : undefined);
  const cancel = useCancelOrder();

  let title = t(ORDERS_I18N_KEYS.navDetail);
  let body: ReactElement;
  if (query.isPending && query.fetchStatus !== "idle") {
    body = <Spin />;
  } else if (query.isError || query.data === undefined) {
    body = <ErrorAlert thrown={query.error} onRetry={() => void query.refetch()} />;
  } else {
    const order = query.data;
    title = t(ORDERS_I18N_KEYS.orderTitle, { number: order.number });
    const address = [order.shipping_address.line1, order.shipping_address.city, order.shipping_address.country]
      .filter((part) => part !== undefined && part !== null && part.length > 0)
      .join(", ");
    body = (
      <Flex vertical gap={token.paddingLG}>
        <Space wrap>
          <StatusTag status={orderStatusFamily(order.status)}>{t(orderStatusKey(order.status))}</StatusTag>
          <Typography.Text type="secondary">
            {t(ORDERS_I18N_KEYS.orderPlaced)}: {format.dateTime(order.created_at) ?? ""}
          </Typography.Text>
        </Space>
        <Descriptions column={1} size="small" bordered>
          {order.lines.map((line) => (
            <Descriptions.Item key={line.id} label={`${line.title} × ${line.quantity}`}>
              {money(line.line_total, order.currency)}
            </Descriptions.Item>
          ))}
          <Descriptions.Item label={t(ORDERS_I18N_KEYS.orderTotal)}>
            <Typography.Text strong>{money(order.total, order.currency)}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t(ORDERS_I18N_KEYS.orderDelivery)}>{address}</Descriptions.Item>
        </Descriptions>
        {cancel.isError && <ErrorAlert thrown={cancel.error} />}
        {order.cancellable && (
          <Button
            danger
            loading={cancel.isPending}
            data-testid={ORDERS_TESTIDS.orderCancel}
            data-analytics="none"
            data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime"
            onClick={() => cancel.mutate(order.id)}
          >
            {t(ORDERS_I18N_KEYS.orderCancel)}
          </Button>
        )}
      </Flex>
    );
  }

  return (
    <Page
      title={title}
      measure="reading"
      data-testid={ORDERS_TESTIDS.pageOrder}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      {body}
    </Page>
  );
}
