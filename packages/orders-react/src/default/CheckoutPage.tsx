import { useRef } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Form, Input, Typography } from "antd";
import { hasErrorCode, useT } from "@stapel/core";
import { ErrorAlert, Page } from "@stapel/tokens-antd/skin";
import type { Order } from "../api/types.js";
import { ORDERS_I18N_KEYS } from "../i18n/keys.js";
import { useCheckout } from "../model/mutations.js";
import { useCart } from "../model/queries.js";
import { ORDERS_TESTIDS } from "../testids.js";
import { useMoney } from "./money.js";
import { defaultOrderHref } from "./navigate.js";
import type { NavigateProp, ThemeModeProp } from "./types.js";

/** Field limits — the backend's `max_length`s (stapel-orders §5). */
const LIMITS = { name: 120, phone: 32, email: 254, line1: 200, city: 100, country: 2, comment: 500 } as const;

interface CheckoutForm {
  name: string;
  phone: string;
  email?: string;
  line1: string;
  city: string;
  country: string;
  comment?: string;
}

export interface CheckoutPageProps extends ThemeModeProp, NavigateProp {
  /** Where a placed order leads. Default `/orders/<id>` (`orders.detail`). */
  readonly orderHref?: (orderId: number) => string;
  /** Called with the placed order before navigating. */
  readonly onPlaced?: (order: Order) => void;
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Checkout (`orders.checkout`, `/checkout`): contact and address, one submit.
 * The submit sends the same idempotency key until it succeeds, so a double
 * click places one order. On `cart_price_changed` the refreshed total is shown
 * and the next submit goes through at the price the person now sees.
 */
export function CheckoutPage(props: CheckoutPageProps): ReactElement {
  const t = useT();
  const money = useMoney();
  const cart = useCart();
  const checkout = useCheckout();
  const required = { required: true, whitespace: true, message: t(ORDERS_I18N_KEYS.fieldRequired) };

  // A second click lands before React re-renders with `isPending`; the ref
  // closes that window (and the key would make a replay harmless anyway).
  const inFlight = useRef(false);

  const onFinish = (values: CheckoutForm): void => {
    if (inFlight.current || checkout.isPending) return;
    inFlight.current = true;
    const email = blankToUndefined(values.email);
    const comment = blankToUndefined(values.comment);
    checkout.mutate(
      {
        contact: {
          name: values.name.trim(),
          phone: values.phone.trim(),
          ...(email !== undefined ? { email } : {}),
        },
        shippingAddress: {
          line1: values.line1.trim(),
          city: values.city.trim(),
          country: values.country.trim().toUpperCase(),
        },
        ...(comment !== undefined ? { comment } : {}),
      },
      {
        onSettled: () => {
          inFlight.current = false;
        },
        onSuccess: (order) => {
          props.onPlaced?.(order);
          const href = (props.orderHref ?? defaultOrderHref)(order.id);
          if (props.onNavigate !== undefined) props.onNavigate(href);
          else if (typeof window !== "undefined") window.location.assign(href);
        },
      }
    );
  };

  const priceChanged = checkout.isError && hasErrorCode(checkout.error, "error.409.cart_price_changed");

  return (
    <Page
      title={t(ORDERS_I18N_KEYS.checkoutTitle)}
      measure="narrow"
      data-testid={ORDERS_TESTIDS.pageCheckout}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      {cart.data !== undefined && cart.data.lines.length > 0 && (
        <Typography.Text strong data-testid={ORDERS_TESTIDS.cartTotal}>
          {t(ORDERS_I18N_KEYS.cartTotal)}: {money(cart.data.total, cart.data.currency)}
        </Typography.Text>
      )}
      {priceChanged ? (
        <Alert type="warning" showIcon title={t(ORDERS_I18N_KEYS.checkoutPriceChanged)} />
      ) : (
        checkout.isError && <ErrorAlert thrown={checkout.error} />
      )}
      <Form<CheckoutForm> layout="vertical" onFinish={onFinish} requiredMark="optional">
        <Typography.Title level={2}>{t(ORDERS_I18N_KEYS.checkoutContact)}</Typography.Title>
        <Form.Item name="name" label={t(ORDERS_I18N_KEYS.fieldName)} rules={[required]}>
          <Input name="name" autoComplete="name" maxLength={LIMITS.name} />
        </Form.Item>
        <Form.Item name="phone" label={t(ORDERS_I18N_KEYS.fieldPhone)} rules={[required]}>
          <Input name="phone" type="tel" autoComplete="tel" maxLength={LIMITS.phone} />
        </Form.Item>
        <Form.Item name="email" label={t(ORDERS_I18N_KEYS.fieldEmail)}>
          <Input name="email" type="email" autoComplete="email" maxLength={LIMITS.email} />
        </Form.Item>
        <Typography.Title level={2}>{t(ORDERS_I18N_KEYS.checkoutAddress)}</Typography.Title>
        <Form.Item name="line1" label={t(ORDERS_I18N_KEYS.fieldLine1)} rules={[required]}>
          <Input name="line1" autoComplete="street-address" maxLength={LIMITS.line1} />
        </Form.Item>
        <Form.Item name="city" label={t(ORDERS_I18N_KEYS.fieldCity)} rules={[required]}>
          <Input name="city" autoComplete="address-level2" maxLength={LIMITS.city} />
        </Form.Item>
        <Form.Item
          name="country"
          label={t(ORDERS_I18N_KEYS.fieldCountry)}
          rules={[
            required,
            { pattern: /^\s*[A-Za-z]{2}\s*$/, message: t(ORDERS_I18N_KEYS.fieldCountryFormat) },
          ]}
        >
          <Input name="country" autoComplete="country" maxLength={LIMITS.country} />
        </Form.Item>
        <Form.Item name="comment" label={t(ORDERS_I18N_KEYS.fieldComment)}>
          <Input.TextArea name="comment" maxLength={LIMITS.comment} autoSize />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={checkout.isPending}
          data-testid={ORDERS_TESTIDS.checkoutSubmit}
          data-analytics="none"
          data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime and no flow machine for a single POST"
        >
          {t(ORDERS_I18N_KEYS.checkoutSubmit)}
        </Button>
      </Form>
    </Page>
  );
}
