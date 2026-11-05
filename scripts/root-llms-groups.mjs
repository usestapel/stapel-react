// The curated layer of the root llms.txt (scripts/gen-root-llms.mjs): which
// DOMAIN a package serves, and one short line saying what it is for. The
// package's own llms.txt carries the full surface; this line only has to let
// a reader pick it. Keep a line under ~110 characters.
//
// A package missing here is NOT dropped: the index lists it under "Not yet
// curated" with the first sentence of its package.json description, so a new
// pair is findable the day it lands, and the gap is visible until someone
// files it here. A name here that is no longer a public package fails the
// build (a curated line for a package that does not exist is a lie).

export const ROOT_LLMS_GROUPS = [
  {
    title: "Accounts and people",
    packages: {
      "@stapel/auth-react": "sign-in flows (OTP, password, OAuth, TOTP, passkeys, magic link, QR, SSO), sessions, step-up",
      "@stapel/profiles-react": "my profile and public profiles, avatar upload, follow/block, contacts, setup gate",
      "@stapel/workspaces-react": "workspaces, members, invitations, capabilities and capability gates, audit",
      "@stapel/gdpr-react": "account closure with its grace, entity erasure, pending deletions, data export, DSAR intake",
    },
  },
  {
    title: "Catalog and commerce",
    packages: {
      "@stapel/listings-react": "listing composer, listing page (with the page.actions slot), owner dashboard, favourites, share",
      "@stapel/categories-react": "category tree, revision-delta sync, category pages",
      "@stapel/attributes-react": "value editors and renderers for dynamic feature types in a category schema",
      "@stapel/vocabularies-react": "term typeahead and code-to-label resolve for large reference vocabularies",
      "@stapel/search-react": "search client, URL-first filter state, result and facet hooks",
      "@stapel/orders-react": "cart, idempotent checkout, order history, add-to-cart embed for a listing page",
      "@stapel/currencies-react": "money formatting and conversion per locale and currency",
      "@stapel/billing-react": "wallet of expiring credit lots, holds and debts; catalog, checkout, subscriptions, transactions",
      "@stapel/reviews-react": "ratings and reviews of any (target_type, target_key)",
      "@stapel/geo-react": "location picker: map, search-as-you-type, browser position, draggable pin",
    },
  },
  {
    title: "Content and media",
    packages: {
      "@stapel/docs-react": "documents with snapshot saves, the editor_hint registry, sharing",
      "@stapel/drive-react": "phone-first drive over docs: starred, recents, search, thumbnails, share sheet, uploads",
      "@stapel/forms-react": "form fill, builder, responses and settings",
      "@stapel/cdn-react": "dedup-first media upload client (hash, exists check, upload)",
      "@stapel/recordings-react": "recordings list, upload, player, transcript with payload-driven polling",
      "@stapel/video-react": "per-scope video usage by calendar month",
      "@stapel/translate-react": "remote locales and text translation",
    },
  },
  {
    title: "Communication and work",
    packages: {
      "@stapel/chat-react": "chat threads with a seq-ordered store behind one transport seam",
      "@stapel/notifications-react": "notification feed, unread count, push device registration",
      "@stapel/calendar-react": "calendars and events; month/week/day view that degrades to an agenda on a phone",
      "@stapel/tasks-react": "task boards with move state machine, kanban skin",
      "@stapel/brick-react": "small brick games (Tetris, Snake, …) for waiting screens",
    },
  },
  {
    title: "Operations",
    packages: {
      "@stapel/moderation-react": "moderation cases, queues, sanctions, appeals, DLQ",
      "@stapel/alerts-react": "error-tracker triage feed grouped by service, reconcile from a browser",
      "@stapel/webhooks-react": "webhook subscriptions, event catalog, deliveries, secret rotation",
    },
  },
  {
    title: "Substrate",
    packages: {
      "@stapel/core": "runtime every pair builds on: typed fetch, error envelope, auth seams, query layer, i18n, nav contract",
      "@stapel/shell-react": "app chrome from the pairs' nav manifests: resolveNav, AppShell, PublicShell, slots, icons",
      "@stapel/realtime": "one reconnect/resume WebSocket runtime for every pair",
      "@stapel/image": "CDN variant math and a blur-up <Image>",
      "@stapel/analytics": "analytics facade: consent gate, PII guard, offline queue, provider fan-out",
      "@stapel/showcase": "defineDemo, the statically extractable demo format",
      "@stapel/eslint-plugin": "frontend guardrails as lint rules (no raw colours, no raw fetch, i18n keys, …)",
    },
  },
  {
    title: "Design tokens",
    packages: {
      "@stapel/tokens": "the §68 colour-role dictionary compiled to CSS custom properties",
      "@stapel/tokens-antd": "tokens bridged to antd, plus the shared antd skin components",
      "@stapel/tokens-mui": "tokens bridged to MUI",
    },
  },
];
