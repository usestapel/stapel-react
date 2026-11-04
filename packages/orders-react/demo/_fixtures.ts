/** Canned stapel-orders answers for the demos and the wiring tests. */
import type { Cart, Order, OrderPage } from "../src/index.js";

export const DEMO_CART: Cart = {
  id: 7,
  currency: "USD",
  lines: [
    {
      id: 11,
      purchasable_type: "listing",
      purchasable_key: "101",
      title: "Brake pads, front axle",
      quantity: 2,
      unit_price: "24.50",
      currency: "USD",
      line_total: "49.00",
      image: null,
      url: null,
      seller_id: "s-1",
    },
    {
      id: 12,
      purchasable_type: "listing",
      purchasable_key: "102",
      title: "Oil filter",
      quantity: 1,
      unit_price: "8.90",
      currency: "USD",
      line_total: "8.90",
      image: null,
      url: null,
      seller_id: "s-1",
    },
  ],
  line_count: 2,
  subtotal: "57.90",
  total: "57.90",
  updated_at: "2026-11-05T10:00:00Z",
};

export const DEMO_EMPTY_CART: Cart = {
  id: null,
  currency: null,
  lines: [],
  line_count: 0,
  subtotal: "0.00",
  total: "0.00",
  updated_at: null,
};

export const DEMO_ORDER: Order = {
  id: 501,
  number: "20261105-K3J9XQ",
  status: "new",
  payment_status: "unpaid",
  currency: "USD",
  subtotal: "57.90",
  total: "57.90",
  lines: DEMO_CART.lines.map((line) => ({
    id: line.id + 1000,
    purchasable_type: line.purchasable_type,
    purchasable_key: line.purchasable_key,
    title: line.title,
    quantity: line.quantity,
    unit_price: line.unit_price,
    line_total: line.line_total,
    image: line.image,
    url: line.url,
    seller_id: line.seller_id,
  })),
  contact: { name: "Alex Doe", phone: "+1 555 0100", email: "" },
  shipping_address: {
    line1: "1 Main Street",
    line2: "",
    city: "Springfield",
    region: "",
    postal_code: "",
    country: "US",
  },
  shipping_method: "",
  comment: "",
  created_at: "2026-11-05T10:05:00Z",
  updated_at: "2026-11-05T10:05:00Z",
  cancellable: true,
};

export const DEMO_ORDER_PAGE: OrderPage = {
  items: [
    DEMO_ORDER,
    { ...DEMO_ORDER, id: 488, number: "20261020-P2M7AA", status: "completed", cancellable: false },
  ],
  count: 2,
  has_next: false,
  has_prev: false,
  next_anchor: null,
  prev_anchor: null,
};
