/**
 * Shared harness for the chat-react demos (frontend-guardrails §4.2). Demos are
 * first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`: colours are tokens, every
 * label is an i18n key.
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) and a
 * STANDING-IN realtime client whose stream is already live — see
 * {@link liveRealtimeClient}.
 *
 * ── Why the socket is no longer simply switched off ────────────────────────
 *
 * It used to be (`realtime: { socketUrl: null }`), on the argument that a demo
 * shows the SCREEN and the seam makes the screen the same either way. The
 * screen is not the same, and the shots proved it: with no socket the seam
 * correctly reports `no_socket`, so every single story wore the sentence
 * "Live messages are off here — refreshing every few seconds instead" as a
 * standing banner. A catalogue of a chat product in which every frame carries
 * a degradation notice advertises the broken state as the normal one — and it
 * is the very sentence this pair was reported for.
 *
 * The second reason is worse and less visible: with no live socket the
 * freshness seam POLLS (3 s in a thread, 15 s in the inbox) and a poll
 * refetches the seeded queries with `type: "active"`, which ignores
 * `staleTime` entirely. So a seeded demo left open for three seconds threw its
 * seed away and rendered whatever the canned server happened to answer. A live
 * stream is what stops the timer.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { RealtimeProvider } from "@stapel/realtime/react";
import type {
  RealtimeClient,
  RealtimeState,
  RealtimeStreamStatus,
  RealtimeSubscription,
} from "@stapel/realtime";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { ChatProvider, createChatRuntime, registerChatI18n } from "../src/index.js";
import type { ChatPeopleSlot, ChatPerson } from "../src/index.js";
import { chatQueryKeys } from "../src/model/queryKeys.js";
import type { ChatThreadWindow } from "../src/model/threadWindow.js";
import type { ChatMessage, Conversation, ConversationPage } from "../src/api/types.js";

/**
 * WHO THE DEMO PEOPLE ARE.
 *
 * `ConversationResponse` names nobody — it carries participant ids — so the
 * skin asks the runtime's people seam, and a catalogue with no seam wired
 * would photograph "Name unavailable" on every inbox row. That sentence is
 * correct and it is exactly what a container that forgot the wiring must see;
 * it is not what the shipped screen looks like, and a catalogue documents the
 * shipped screen. So the demo runtime wires the seam the way a storefront
 * does (`useProfilesBatch` there, a canned table here).
 */
const DEMO_PEOPLE: Readonly<Record<string, string>> = {
  "u-seller": "Marta Kovács",
  "u-anton": "Anton Berg",
  "u-support": "Support team",
};

const demoPeopleSlot: ChatPeopleSlot = (props) =>
  props.children({
    pending: false,
    lookup: (userId): ChatPerson | null => {
      const displayName = DEMO_PEOPLE[userId];
      return displayName === undefined ? null : { userId, displayName };
    },
  });

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

/**
 * Build a canned `fetch` from a suffix→response map.
 *
 * AN UNDECLARED PATH IS A 404, NOT AN EMPTY 200. It used to be `{}` at status
 * 200, and that default is what turned three seeded thread variants into three
 * ERROR cards: the thread demo declared `/read` and nothing else, so
 * `GET …/messages` was answered `{}`, `threadWindowFromPage` read `.items` off
 * `undefined`, and TanStack Query recorded a rejected query function. The
 * seeded window was still in the cache and the panel still rendered the failed
 * arm, because a query that HAS data and an error is an error.
 *
 * A demo mock that answers a request nobody wrote a handler for is a mock that
 * cannot be wrong on screen — it is wrong one layer down, inside the pair's own
 * parser, where the failure arrives wearing the wrong name. So an unmatched
 * path now answers the way the real server answers an unknown route, and a
 * missing handler shows up as the demo's own failure arm with the right
 * sentence in it.
 */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let matched: DemoResponse = [404, { localizable_error: "error.404.not_found" }];
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

/**
 * Prime the query cache before the first paint.
 *
 * A demo whose data arrives over `fetch` renders a SPINNER on its first frame,
 * and a static shot runner never gets a second one — so four variants named for
 * four different states photograph the same spinner, and the catalogue claims
 * coverage it does not have (that is exactly what `assertVariantsRenderDistinctly`
 * exists to catch). Seeding puts the state on screen synchronously, which is
 * also what a person opening the viewer wants to see.
 *
 * SEEDING THE CACHE IS ONLY HALF OF IT. A seed that is immediately refetched
 * over is a seed that survives exactly one frame — a static markup renderer
 * (which runs no effects) sees the state, and the mounted screen a person or a
 * shot runner looks at sees whatever the mock answered instead. That is how
 * three seeded inbox variants all photographed the EMPTY card: the seed was
 * three conversations, the declared handler answered `{items: []}`, and the
 * mount refetch replaced one with the other before anyone looked.
 *
 * So a seeded demo also pins its queries (`staleTime: Infinity`,
 * `refetchOnMount: false` — see {@link ChatDemoHarness}) AND declares handlers
 * that agree with the seed ({@link inboxPage}, {@link messagePage}). Either one
 * alone leaves a hole: the pin does not stop the transport seam's own
 * `refetchQueries`, and matching handlers alone still cost a round trip the
 * first frame is racing.
 */
export type DemoSeed = (queryClient: QueryClient) => void;

/** One page of conversations, in the shape the wire sends it. */
export function inboxPage(
  rows: readonly Conversation[],
  options?: { readonly hasNext?: boolean }
): ConversationPage {
  return {
    items: [...rows],
    next_anchor: options?.hasNext === true ? "2026-08-21T18:00:00Z" : null,
    prev_anchor: null,
    has_next: options?.hasNext === true,
    has_prev: false,
    count: rows.length,
  };
}

/**
 * One page of messages, NEWEST-first — the order `direction=next` returns and
 * the one `threadWindowFromPage` is written against. A demo that hands back
 * ascending rows here documents an order no server produces.
 */
export function messagePage(messages: readonly ChatMessage[]): {
  items: ChatMessage[];
  next_anchor: null;
  prev_anchor: null;
  has_next: false;
  has_prev: boolean;
  count: number;
} {
  return {
    items: [...messages].sort((a, b) => b.seq - a.seq),
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: messages.length,
  };
}

/** Seed the inbox with one page of conversations. */
export function seedInbox(
  rows: readonly Conversation[],
  options?: { readonly hasNext?: boolean }
): DemoSeed {
  const page = inboxPage(rows, options);
  return (queryClient) => {
    queryClient.setQueryData(chatQueryKeys.conversations(), {
      pages: [page],
      pageParams: [undefined],
    });
  };
}

/** Seed one thread's window (ascending by `seq`, as the store holds it). */
export function seedThread(
  conversationId: string,
  messages: readonly ChatMessage[],
  options?: { readonly hasOlder?: boolean }
): DemoSeed {
  const window: ChatThreadWindow = {
    messages: [...messages].sort((a, b) => a.seq - b.seq),
    hasOlder: options?.hasOlder ?? false,
    olderAnchor: options?.hasOlder === true ? "1" : null,
  };
  return (queryClient) => {
    queryClient.setQueryData(chatQueryKeys.thread(conversationId), window);
  };
}

/** Run several seeds as one. */
export function seedAll(...seeds: readonly DemoSeed[]): DemoSeed {
  return (queryClient) => {
    for (const seed of seeds) seed(queryClient);
  };
}

// ── the standing-in realtime client ──────────────────────────────────────────

/**
 * The socket origin the demo runtime derives its stream URLs from. Nothing is
 * ever opened to it — {@link liveRealtimeClient} answers instead — but it has
 * to be non-null, because `socketUrl: null` is itself a NAMED degradation
 * (`no_socket`) and saying so out loud is the seam working correctly.
 */
const DEMO_SOCKET_ORIGIN = "wss://chat.demo.stapel.dev";

function liveStatus(stream: string): RealtimeStreamStatus {
  return {
    stream,
    state: "live",
    refusal: undefined,
    reason: undefined,
    attempt: 0,
    cursor: 0,
    gap: undefined,
    serverSeq: undefined,
  };
}

const LIVE_STATE: RealtimeState = {
  state: "open",
  connected: true,
  reconnecting: false,
  refused: false,
  refusal: undefined,
  reason: undefined,
  attempt: 0,
  cursors: {},
  everConnected: true,
  firstAttemptAt: 0,
  lastOpenAt: 0,
  degradation: null,
  refreshing: null,
};

/**
 * A `RealtimeClient` that is ALREADY LIVE on its first synchronous read, and
 * that opens nothing.
 *
 * ── Why the demos needed one ───────────────────────────────────────────────
 *
 * With the socket switched off the seam reports `no_socket`, which is correct
 * and which put "Live messages are off here — refreshing every few seconds
 * instead" on EVERY story of this pair. A catalogue in which every frame of a
 * chat product carries a degradation notice documents the broken deployment as
 * the normal one, and it does it with the exact sentence this pair was
 * reported for. A banner that is always on is not a banner.
 *
 * It also stops the freshness timer. Polling runs whenever the socket is not
 * carrying the stream, and a poll calls `refetchQueries({ type: "active" })` —
 * which ignores `staleTime`, so it walks straight through the pinned query
 * defaults below and replaces a seeded variant with whatever the canned server
 * answers, three seconds after anyone opened it. Pinning the cache fixes the
 * mount; only a live stream fixes the tick.
 *
 * `useStream` seeds its state from `client.streamStatus(stream)` DURING the
 * first render rather than from an effect, which is the only reason a static
 * shot can show a live chat at all: a real handshake is at best a microtask
 * away, so every story would otherwise be photographed mid-connect.
 *
 * It carries no frames, and it is not pretending to test the transport — that
 * is `test/transport.test.tsx`, against the real v1 envelope over a fake
 * `WebSocket`. What this fixes is the CATALOGUE.
 */
function liveRealtimeClient(): RealtimeClient {
  const subscription = (stream: string): RealtimeSubscription => ({
    stream,
    status: () => liveStatus(stream),
    cursor: () => 0,
    send: () => true,
    close: () => undefined,
  });
  return {
    subscribe: (stream) => subscription(stream),
    getState: () => LIVE_STATE,
    streamStatus: (stream) => liveStatus(stream),
    cursors: () => ({}),
    onState: () => () => undefined,
    reconnect: () => undefined,
    close: () => undefined,
  };
}

/** Provider frame every chat demo variant renders inside. */
export function ChatDemoHarness(props: {
  handlers?: DemoHandlers;
  /** Cache primed before the first render — see {@link DemoSeed}. */
  seed?: DemoSeed;
  /**
   * `"live"` (default) mounts {@link liveRealtimeClient}, so the screen is the
   * one a working deployment renders. `"off"` is a deployment with no sockets
   * at all — a real, supported configuration, and the ONE place the named
   * degradation belongs. Never make it the default again.
   */
  socket?: "live" | "off";
  children: ReactNode;
}): ReactElement {
  const { handlers, seed } = props;
  const live = (props.socket ?? "live") === "live";
  const { runtime, queryClient, i18n, realtime } = useMemo(() => {
    const rt = createChatRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
      realtime: { socketUrl: live ? DEMO_SOCKET_ORIGIN : null },
      slots: { people: demoPeopleSlot },
    });
    const engine = createI18n({ locale: "en" });
    registerChatI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // A SEEDED DEMO IS NOT A STALE ONE. TanStack's default `staleTime: 0`
          // makes every seeded query stale the instant it is read, so the mount
          // refetch fires and the answer — an empty page, a 404 for a path the
          // demo never declared — lands on top of the state the variant is
          // NAMED for. Three inbox variants photographed the empty card that
          // way, and three thread variants the error card.
          staleTime: Number.POSITIVE_INFINITY,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    });
    // Before the provider mounts, so the first render is already the state.
    seed?.(client);
    return {
      runtime: rt,
      queryClient: client,
      i18n: engine,
      realtime: live ? liveRealtimeClient() : null,
    };
  }, [handlers, seed, live]);
  const inner = (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <ChatProvider runtime={runtime}>{props.children}</ChatProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
  // `<ChatProvider>` adopts a client that is already in context instead of
  // building a second socket stack, so this is the shipped host path and not a
  // demo-only door.
  return realtime === null ? (
    inner
  ) : (
    <RealtimeProvider url={DEMO_SOCKET_ORIGIN} client={realtime} session={null}>
      {inner}
    </RealtimeProvider>
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

// ── typed fixtures for the seeded (default-skin) demos ───────────────────────
//
// These are `Conversation` / `ChatMessage` proper — the generated wire types —
// so a field the 0.6 contract added or renamed breaks the demo at compile time
// rather than rendering a screen that no server produces.

function conversation(
  id: string,
  overrides: Partial<Conversation> = {}
): Conversation {
  return {
    id,
    kind: "direct",
    scope_key: "global",
    support_status: "",
    last_seq: 3,
    unread_count: 0,
    created_at: "2026-08-20T09:00:00Z",
    updated_at: "2026-08-21T18:12:00Z",
    participants: [
      { user_id: "u-buyer", role: "member", last_read_seq: 3 },
      { user_id: "u-seller", role: "member", last_read_seq: 3 },
    ],
    ...overrides,
  };
}

/** The buyer every demo reads as. */
export const DEMO_VIEWER = "u-buyer";

/** A short listing card, in the shape `classified.subject_cards` serves. */
function listingSubject(title: string, price: number): NonNullable<Conversation["subject"]> {
  return {
    type: "listing",
    key: "42",
    card: {
      listing_id: "42",
      title,
      price,
      currency: "EUR",
      state: "available",
      url: "/listings/42",
      image: null,
      meta_status: "ok",
    },
    meta_status: "ok",
  };
}

/**
 * A busy inbox: two people and a support case — with DIFFERENT
 * counterparties, because "three rows, three names" is the whole point of the
 * row, and three rows with one name would document the defect instead.
 */
export const DEMO_INBOX: readonly Conversation[] = [
  conversation("8f14e45f-ceea-467a-9b58-2f0b0b1a6b21", {
    unread_count: 2,
    subject: listingSubject("Racing bicycle, almost new", 240),
  }),
  conversation("1c3d5e7f-2b4a-4c6d-8e0f-1a2b3c4d5e6f", {
    updated_at: "2026-08-21T11:40:00Z",
    participants: [
      { user_id: DEMO_VIEWER, role: "member", last_read_seq: 3 },
      { user_id: "u-anton", role: "member", last_read_seq: 3 },
    ],
  }),
  conversation("aa11bb22-cc33-4d44-9e55-ff6677889900", {
    kind: "support",
    support_status: "open",
    updated_at: "2026-08-20T16:05:00Z",
  }),
];

/** The thread the panel demos open, ascending by `seq`. */
export const DEMO_THREAD_ID = DEMO_INBOX[0]?.id ?? "";

function message(
  seq: number,
  body: string,
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    id: `m-${String(seq)}`,
    conversation_id: DEMO_THREAD_ID,
    seq,
    // The journal cursor the socket resumes on. It equals `seq` until
    // something is edited or deleted — that divergence is the whole reason
    // the two numbers have different names.
    rev_seq: seq,
    kind: "text",
    body,
    created_at: "2026-08-21T18:10:00Z",
    sender_id: "u-buyer",
    reply_to: null,
    attachments: [],
    ...overrides,
  };
}

export const DEMO_THREAD_MESSAGES: readonly ChatMessage[] = [
  message(1, "Conversation started.", {
    kind: "system",
    sender_id: null,
    created_at: "2026-08-20T09:00:00Z",
  }),
  message(2, "Hello! Is the bicycle still available?"),
  message(3, "It is still available — when would you like to pick it up?", {
    sender_id: "u-seller",
    created_at: "2026-08-21T18:12:00Z",
  }),
];

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
