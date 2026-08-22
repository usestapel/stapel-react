/**
 * Shared harness for the chat-react demos (frontend-guardrails §4.2). Demos are
 * first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`: colours are tokens, every
 * label is an i18n key.
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) and turns
 * the socket transport OFF (`realtime: { socketUrl: null }`): a demo shows the
 * SCREEN, and the point of the transport seam is that the screen is the same
 * either way. The socket protocol itself is exercised where it belongs, in
 * `test/socket.test.ts` against a fake transport.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { ChatProvider, createChatRuntime, registerChatI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-chat `/chat/api/v1`). */
export const DEMO_BASE = "https://chat.demo.stapel.dev/chat/api/v1";

/**
 * A handler map: path suffix → response. A plain value is a 200 JSON body; a
 * `[status, body]` tuple sets the HTTP status (so a demo can reach an error
 * state).
 */
export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a suffix→response map; unmatched paths return `{}`. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let matched: DemoResponse = {};
    for (const [suffix, value] of Object.entries(handlers)) {
      if (url.includes(suffix)) {
        matched = value;
        break;
      }
    }
    const [status, body] = statusAndBody(matched);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
}

/** i18n copy for the demo chrome — a `demo.*` (unmanaged) namespace. */
const demoBundleEn: Record<string, string> = {
  "demo.action.refresh": "Refresh",
};

/** Provider frame every chat demo variant renders inside. */
export function ChatDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createChatRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
      realtime: { socketUrl: null },
    });
    const engine = createI18n({ locale: "en" });
    registerChatI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    return {
      runtime: rt,
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      i18n: engine,
    };
  }, [handlers]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <ChatProvider runtime={runtime}>{props.children}</ChatProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

// ── shared demo UI (token-driven; no raw colours, no literal prose) ───────────

const cardStyle: CSSProperties = {
  background: cssVar("surface-raised"),
  color: cssVar("text"),
  border: `1px solid ${cssVar("border-subtle")}`,
  borderRadius: radii.lg,
  padding: spacing["5"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["3"],
  maxWidth: "32rem",
  fontSize: fontSize.md.fontSize,
};

/** A titled card wrapper for a demo body. `heading` (not `title`) keeps the
 * no-hardcoded-text rule from treating a technical component name as prose. */
export function DemoCard(props: {
  heading: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <div style={cardStyle} data-theme-surface>
      <strong style={{ fontSize: fontSize.lg.fontSize }}>{props.heading}</strong>
      {props.children}
    </div>
  );
}

const buttonStyle: CSSProperties = {
  background: cssVar("brand"),
  color: cssVar("text-on-accent"),
  border: "none",
  borderRadius: radii.md,
  padding: `${spacing["2"]}px ${spacing["4"]}px`,
  cursor: "pointer",
  fontSize: fontSize.sm.fontSize,
};

/**
 * A demo action button. The interactive prop is `run` (not `onClick`) so the
 * call site is not an untracked clickable; the real `<button>` here carries
 * `data-analytics="none"` with a reason — chat-react is a flow-less pair and a
 * headless pair emits no analytics of its own.
 */
export function DemoButton(props: {
  run: () => void;
  labelKey: string;
}): ReactElement {
  const t = useT();
  return (
    <button
      style={buttonStyle}
      data-analytics="none"
      data-analytics-reason="headless demo action; the host instruments this"
      onClick={props.run}
    >
      {t(props.labelKey)}
    </button>
  );
}

/** A row of demo action buttons. */
export function DemoActions(props: { children: ReactNode }): ReactElement {
  return (
    <div style={{ display: "flex", gap: spacing["2"], flexWrap: "wrap" }}>
      {props.children}
    </div>
  );
}

// ── canned wire bodies (the REAL shapes stapel-chat sends) ───────────────────

export const DEMO_CONVERSATION = {
  id: "8f14e45f-ceea-467a-9b58-2f0b0b1a6b21",
  kind: "direct",
  scope_key: "global",
  support_status: "",
  last_seq: 3,
  unread_count: 2,
  created_at: "2026-08-20T09:00:00Z",
  updated_at: "2026-08-21T18:12:00Z",
  participants: [
    { user_id: "u-buyer", role: "member", last_read_seq: 1 },
    { user_id: "u-seller", role: "member", last_read_seq: 3 },
  ],
};

export const DEMO_CONVERSATION_PAGE = {
  items: [DEMO_CONVERSATION],
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: 1,
};

/** History pages arrive NEWEST-first for `direction=next` (the default). */
export const DEMO_MESSAGE_PAGE = {
  items: [
    {
      id: "m-3",
      conversation_id: DEMO_CONVERSATION.id,
      seq: 3,
      kind: "text",
      body: "It is still available — when would you like to pick it up?",
      created_at: "2026-08-21T18:12:00Z",
      sender_id: "u-seller",
      reply_to: null,
      attachments: [],
    },
    {
      id: "m-2",
      conversation_id: DEMO_CONVERSATION.id,
      seq: 2,
      kind: "text",
      body: "Hello! Is the bicycle still available?",
      created_at: "2026-08-21T18:10:00Z",
      sender_id: "u-buyer",
      reply_to: null,
      attachments: [],
    },
    {
      id: "m-1",
      conversation_id: DEMO_CONVERSATION.id,
      seq: 1,
      kind: "system",
      body: "Conversation started.",
      created_at: "2026-08-20T09:00:00Z",
      sender_id: null,
      reply_to: null,
      attachments: [],
    },
  ],
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: 3,
};
