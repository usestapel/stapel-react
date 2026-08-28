// @stapel/eslint-plugin — the enforcement tier of the frontend guardrails
// (frontend-guardrails §2). Rules are data-driven: they read the same generated
// manifests (@stapel/tokens/manifest.json, pair i18n key registries) the
// codegen writes, so lint and code never drift. Ships a flat-config
// `recommended` preset; the stylelint preset lives at @stapel/eslint-plugin/
// stylelint.
import { readFileSync } from "node:fs";
import noRawColors from "./rules/no-raw-colors.js";
import validTokenName from "./rules/valid-token-name.js";
import noRawTokenImport from "./rules/no-raw-token-import.js";
import noRawFetch from "./rules/no-raw-fetch.js";
import noStringPaths from "./rules/no-string-paths.js";
import queryKeysFromFactory from "./rules/query-keys-from-factory.js";
import i18nKeyExists from "./rules/i18n-key-exists.js";
import noHardcodedText from "./rules/no-hardcoded-text.js";
import requireDisableDescription from "./rules/require-disable-description.js";
import clickableNeedsEvent from "./rules/clickable-needs-event.js";
import noDoubleCount from "./rules/no-double-count.js";
import eventLiteralMeta from "./rules/event-literal-meta.js";
import knownEvent from "./rules/known-event.js";
import noDirectAnalyticsProvider from "./rules/no-direct-analytics-provider.js";
import demoLiteralMeta from "./rules/demo-literal-meta.js";
import noRawStorage from "./rules/no-raw-storage.js";
import noAdhoc401 from "./rules/no-adhoc-401.js";
import noReservedBackendRoute from "./rules/no-reserved-backend-route.js";
import noRawErrorShape from "./rules/no-raw-error-shape.js";
import noFlattenedLoadState from "./rules/no-flattened-load-state.js";
import noCyrillicSource from "./rules/no-cyrillic-source.js";
import noMixedScriptWord from "./rules/no-mixed-script-word.js";
import noBareDialog from "./rules/no-bare-dialog.js";
import noTooltipInSkin from "./rules/no-tooltip-in-skin.js";
import iconButtonNeedsLabel from "./rules/icon-button-needs-label.js";
import noHardcodedThemeMode from "./rules/no-hardcoded-theme-mode.js";
import noLocalSkinTheme from "./rules/no-local-skin-theme.js";
import noRawDimensions from "./rules/no-raw-dimensions.js";
import i18nLocaleParity from "./rules/i18n-locale-parity.js";
import noAdhocSocket from "./rules/no-adhoc-socket.js";
import noSilentSlot from "./rules/no-silent-slot.js";
import noBooleanDisabled from "./rules/no-boolean-disabled.js";
import antdAlertTitle from "./rules/antd-alert-title.js";

const rules = {
  "no-raw-colors": noRawColors,
  "valid-token-name": validTokenName,
  "no-raw-token-import": noRawTokenImport,
  "no-raw-fetch": noRawFetch,
  // Server-state guardrails (frontend-guardrails §2.2 / §2.6).
  "no-string-paths": noStringPaths,
  "query-keys-from-factory": queryKeysFromFactory,
  "i18n-key-exists": i18nKeyExists,
  "no-hardcoded-text": noHardcodedText,
  "require-disable-description": requireDisableDescription,
  // Typed-analytics guardrails (frontend-guardrails §3, task G4).
  "clickable-needs-event": clickableNeedsEvent,
  "no-double-count": noDoubleCount,
  "event-literal-meta": eventLiteralMeta,
  "known-event": knownEvent,
  "no-direct-analytics-provider": noDirectAnalyticsProvider,
  // Showcase guardrail (frontend-guardrails §4, task G7).
  "demo-literal-meta": demoLiteralMeta,
  // Session-substrate guardrails (frontend-core-architecture-v2 §43).
  "no-raw-storage": noRawStorage,
  "no-adhoc-401": noAdhoc401,
  // Front/back path-collision guardrail (owner directive: SPA router must not
  // claim a reserved backend sub-path).
  "no-reserved-backend-route": noReservedBackendRoute,
  // Error-dialect guardrail: a caught value is narrowed through the layer,
  // never through a cast (@stapel/core errors.ts "One dialect").
  "no-raw-error-shape": noRawErrorShape,
  // Load-state guardrail: the absence of a result must not be spelled the
  // same way as an empty result (@stapel/core loadState.ts).
  "no-flattened-load-state": noFlattenedLoadState,
  // English-only source canon (owner directive 2026-08-09): identifiers,
  // comments, JSDoc, dev-facing strings are English fleet-wide; Russian UI
  // copy in translation catalogs is unaffected. Two rules split the surface
  // so neither needs a path allowlist — no-cyrillic-source deliberately
  // never looks at string literals (i18n's legitimate home); the literal
  // scan only fires on a homoglyph (one word straddling both scripts).
  "no-cyrillic-source": noCyrillicSource,
  "no-mixed-script-word": noMixedScriptWord,
  // Default-skin dialog surface (owner ruling 2026-08-24): a phone gets a
  // bottom sheet, never a centred modal. One implementation
  // (@stapel/tokens-antd/skin's SkinDialog); this keeps the twelfth dialog
  // from being hand-rolled the old way.
  "no-bare-dialog": noBareDialog,
  // ── The doctrine tier (0.11.0) ──────────────────────────────────────────
  // Ten rules that state, mechanically, the design rulings the fleet keeps
  // re-taking by hand: no hover-only explanations, an accessible name on an
  // icon-only control, one theme owner, one dimension scale, locale parity,
  // one socket client, no silent slots, no reasonless disabled control.
  // They ship at `warn` in `recommended` this release and at `error` in the
  // new `strict` config — see the wiring note below.
  "no-tooltip-in-skin": noTooltipInSkin,
  "icon-button-needs-label": iconButtonNeedsLabel,
  "no-hardcoded-theme-mode": noHardcodedThemeMode,
  "no-local-skin-theme": noLocalSkinTheme,
  "no-raw-dimensions": noRawDimensions,
  "i18n-locale-parity": i18nLocaleParity,
  "no-adhoc-socket": noAdhocSocket,
  "no-silent-slot": noSilentSlot,
  "no-boolean-disabled": noBooleanDisabled,
  // A mechanical vendor deprecation, not doctrine: antd 6 renamed
  // `<Alert message>` to `<Alert title>`. Autofixable, at `error` in
  // `recommended` — there is no migration to sequence, only a rename, and a
  // prop a major version stops reading renders an alert with no heading.
  "antd-alert-title": antdAlertTitle,
};

// Read from package.json rather than typed: this is the version ESLint prints
// for the plugin in `--debug` and in config inspector output — exactly what
// someone reads when asking "which version of this rule am I actually
// running?" — and a literal drifted on three bumps running (0.6.0 on a 0.7.0
// package; then the 0.10.0 version commit). The test in
// recommended-preset.test.js still pins the equality so the read cannot rot.
const { name: pkgName, version: pkgVersion } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const plugin = {
  meta: { name: pkgName, version: pkgVersion },
  rules,
};

const TS_JS = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];
const JSX = ["**/*.{tsx,jsx}"];

// Tests and fixtures legitimately exercise the anti-patterns these rules
// forbid — raw ramps as validator input, deliberately-unknown i18n keys,
// throwaway JSX copy — so the guardrails are scoped off there. Product source,
// demos (`demo/`), and the showcase stay covered.
//
// A rule belongs in this carve-out only when a test's job is to PRODUCE the
// forbidden shape (a fixture IS a raw ramp / an unknown key / a raw envelope).
// It does NOT belong here merely because tests are "not product code": the
// script canon (no-cyrillic-source, no-mixed-script-word) applies to test
// sources exactly as it applies to product sources, and is therefore not
// listed below — see the note at the end of the block.
const TEST_FILES = [
  "**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/fixtures/**",
  "**/*.fixture.{ts,tsx,js,jsx}",
];

// Files that are ALLOWED to reach the raw ramps (theme config + showcase +
// build scripts) — no-raw-token-import is off here (§2.2 overrides).
const RAW_ALLOWED = [
  "**/theme/**",
  "**/*.theme.{ts,tsx,js,mjs,json}",
  "**/stapel.theme.*",
  "**/tokens/**",
  "**/demo/**",
  "**/demos/**",
  "**/*.demo.{ts,tsx,jsx}",
  "**/showcase/**",
  "**/scripts/**",
  "**/*.stories.{ts,tsx,jsx}",
];

// The codegen API layer — the one legal home of fetch (§2.2 override).
const FETCH_ALLOWED = [
  "**/api/**",
  "**/*client.{ts,js}",
  "**/analytics/providers.{ts,js}",
  "**/analytics/src/providers.{ts,js}",
  "**/scripts/**",
];

// The codegen API layer — the one legal home of path STRINGS (the operation
// definitions themselves), mirroring the fetch carve-out (§2.2 override).
const PATHS_ALLOWED = [
  "**/api/**",
  "**/*client.{ts,js}",
  "**/generated/**",
  "**/scripts/**",
];

// The query-key factory file — where the literal key arrays legitimately live
// (§2.2 override; the rest of the pair/app must reach them through the factory).
const KEY_FACTORY = [
  "**/queryKeys.{ts,tsx,js,mjs}",
  "**/*QueryKeys.{ts,tsx,js,mjs}",
  "**/query-keys.{ts,tsx,js,mjs}",
];

// @stapel/core's storage/repository internals — the ONE legal home of direct
// localStorage/indexedDB access (§43.4 override; everything else persists
// through createRepository, which is what makes wipe-at-logout mechanical).
const STORAGE_ALLOWED = [
  "**/core/src/storage.{ts,js}",
  "**/core/src/repository.{ts,js}",
  "**/core/src/query.{ts,js}",
];

// @stapel/core's client + session internals — the ONE legal home of 401
// handling (§43.2 override; the onAuthRefresh seam + SessionManager.refresh()
// are where the single-flight retry lives).
const ADHOC_401_ALLOWED = [
  "**/core/src/client.{ts,js}",
  "**/core/src/session.{ts,js}",
  // The authenticating module's `doRefresh` — the other half of the same
  // seam, not a bypass of it. Somebody has to read the status code the
  // refresh endpoint answered with and decide what it MEANS (revoked vs
  // expired vs "the backend simply isn't there") before handing
  // `SessionManager` an outcome, and this is the one file that does it.
  // Forcing the classification out of here would push it into call sites,
  // which is exactly what this rule exists to prevent.
  "**/auth-react/src/model/session.{ts,js}",
];

// The transport / error layer — the ONE legal home of the raw error shape.
// Somebody has to read `{localizable_error, …}` off the wire and fold it into
// `StapelApiError` (`toStapelApiError`), and that somebody is this layer;
// everywhere else a caught value is narrowed through core's guards. Mirrors
// the FETCH_ALLOWED api-layer carve-out — and the scoping is the point: an
// unscoped rule gets blanket-disabled, and then it guards nothing.
const ERROR_LAYER_ALLOWED = [
  "**/api/**",
  "**/*client.{ts,js}",
  "**/errors.{ts,tsx,js,mjs}",
  "**/*Errors.{ts,tsx,js,mjs}",
  "**/error-layer/**",
  // Node-side CLI/build code: there `catch (e) { e.code === "ENOENT" }` is
  // errno, not a Stapel envelope — a different universe of error, and the
  // one this rule would otherwise flag falsely.
  "**/scripts/**",
  "**/bin/**",
  "**/*.config.{js,mjs,cjs,ts}",
];

// `@stapel/tokens-antd/skin` — the ONE legal home of a bare antd
// `Modal`/`Drawer`, because it is the file that BUILDS `SkinDialog` (and
// `SkinConfirm` on top of it). Every other file in the fleet renders that
// component instead; this one has to render the primitives.
const DIALOG_SUBSTRATE = ["**/tokens-antd/src/skin/**"];

// The api/transport layer + node-side scripts — the one legal home of a
// defaulted `data` (see the rule header). Deliberately NOT extended to
// `**/model/**` or `**/headless/**`: those are exactly where the flatten was
// happening, and a carve-out there would switch the rule off in the only
// place it has ever mattered.
const LOAD_STATE_ALLOWED = [
  "**/api/**",
  "**/*client.{ts,js}",
  "**/generated/**",
  "**/scripts/**",
  "**/bin/**",
];

// ── The doctrine tier (0.11.0) ───────────────────────────────────────────────
//
// These ten rules state design rulings, and design rulings arrive before the
// code that satisfies them: on the day they shipped, nineteen pairs were in
// violation of most of them. A rule that turns a whole fleet red on the day it
// lands does not get adopted — it gets deleted, or blanket-disabled, which is
// worse because the disable outlives the migration.
//
// So there are two tiers, and they say different things:
//
//   `recommended` — these rules at WARN. A warning is a WORKLIST: `eslint .`
//     stays green, every pair keeps shipping, and `pnpm turbo run lint` prints
//     exactly what wave B has to fix, per package, per rule.
//   `strict` — everything `recommended` has, with the doctrine tier at ERROR
//     (and no-bare-dialog covering the confirm surface too). A pair that has
//     finished its migration opts in and cannot regress.
//
// THE SWITCH (one line, marked): when wave B has landed the migrations, change
// `DOCTRINE_LEVEL` below from "warn" to "error" and delete `confirmComponents:
// []` from the no-bare-dialog block. That is the whole flip; the coordinator
// owns it.
const DOCTRINE_LEVEL = "error"; // the migration wave (2026-08-24..26) put every pair on the substrate; doctrine is a gate now

/** Doctrine rules that apply to every source file (.ts included). */
const DOCTRINE_TS = [
  // The skins' theme has ONE owner: the document, read reactively.
  "no-hardcoded-theme-mode",
  "no-local-skin-theme",
  // The px twin of no-raw-colors — autofixable on an exact scale hit.
  "no-raw-dimensions",
  // Locale parity, anchored on each pair's src/i18n/keys.ts (zero wiring).
  "i18n-locale-parity",
  // One socket client for the fleet (the TS half of core's RT001-RT003).
  "no-adhoc-socket",
];

/** Doctrine rules that only mean anything in JSX. */
const DOCTRINE_JSX = [
  "no-tooltip-in-skin",
  "icon-button-needs-label",
  "no-silent-slot",
  "no-boolean-disabled",
];

const doctrineRules = (names, level) =>
  Object.fromEntries(names.map((name) => [`stapel/${name}`, level]));

/**
 * Flat-config `recommended` preset. Consumers spread it AFTER their parser
 * config:
 *
 *   import stapel from "@stapel/eslint-plugin";
 *   export default [ ...tseslint.configs.strict, ...stapel.configs.recommended ];
 */
const recommended = [
  { plugins: { stapel: plugin } },
  {
    files: TS_JS,
    rules: {
      "stapel/no-raw-colors": "error",
      "stapel/valid-token-name": "error",
      "stapel/no-raw-token-import": "error",
      "stapel/no-raw-fetch": "error",
      // Server state: reach endpoints through named operations, keys through the
      // factory (§2.2 / §2.6). Both carved out in their one legal home below.
      "stapel/no-string-paths": "error",
      "stapel/query-keys-from-factory": "error",
      "stapel/i18n-key-exists": "error",
      "stapel/require-disable-description": "error",
      // Typed analytics (§3). Literal-meta keeps events statically extractable;
      // double-count is a hard ban (Q12a); known-event is drift → warn (goes
      // green after `pnpm gen:events`). These fire on .ts (defineEvent, track).
      "stapel/event-literal-meta": "error",
      "stapel/no-double-count": "error",
      "stapel/known-event": "warn",
      // Vendor SDKs only behind the core facade (§2.2 / F9).
      "stapel/no-direct-analytics-provider": "error",
      // Showcase (§4): defineDemo meta must stay literal (extractable).
      "stapel/demo-literal-meta": "error",
      // Session substrate (frontend-core-architecture-v2 §43): persistence
      // only through createRepository; 401 handling only in core's client
      // + SessionManager.
      "stapel/no-raw-storage": "error",
      "stapel/no-adhoc-401": "error",
      // Path-collision guardrail: the SPA router must not claim a reserved
      // backend sub-path (/<mod>/api/…, /<mod>/swagger…, /admin, /staticfiles,
      // /media — §57 nginx canon). No-op without reserved-paths.json.
      "stapel/no-reserved-backend-route": "error",
      // Error dialect: a caught value is `StapelApiError` OR the raw
      // envelope (no `.status`) — narrow through core's guards, never
      // through a cast. Off in the error/transport layer below.
      "stapel/no-raw-error-shape": "error",
      // Load state: `query.data ?? []` makes a failed load indistinguishable
      // from an empty one, which is how a total outage rendered as "you have
      // no workspaces" for hours. Off in the api/transport layer below, where
      // `data` is openapi-fetch's raw half.
      "stapel/no-flattened-load-state": "error",
      // English-only source canon (owner directive 2026-08-09): no Cyrillic
      // in comments/JSDoc/identifiers, and no single word straddling both
      // Latin and Cyrillic scripts anywhere (including string literals —
      // that IS the homoglyph attack). Russian UI copy in i18n catalogs is
      // untouched by either rule (§ no-cyrillic-source docs).
      "stapel/no-cyrillic-source": "error",
      "stapel/no-mixed-script-word": "error",
    },
  },
  {
    // The dialog surface, FLEET-WIDE (0.12.0). It used to be armed only
    // inside `src/default/**`, which meant the one place a team writes its
    // own dialogs — a product repo — could not fail this check at all, and a
    // clean `eslint .` there read as coverage of a doctrine nobody was
    // enforcing. It is a warning outside the skins: a worklist, the same
    // shape the doctrine tier shipped in, so a repo upgrading the plugin gets
    // the list rather than a wall. The shell's navigation drawers are dialogs
    // in neither shape nor purpose and are named here rather than disabled
    // inline.
    files: JSX,
    rules: {
      "stapel/no-bare-dialog": [
        "warn",
        {
          allowNavigationDrawer: ["AppShell.tsx", "PublicShell.tsx"],
        },
      ],
    },
  },
  {
    // …and an ERROR in the default skins, which have already migrated. The
    // wall stays exactly where it was; only the surface below it is new.
    files: ["**/src/default/**/*.{tsx,jsx}"],
    rules: {
      "stapel/no-bare-dialog": [
        "error",
        {
          allowNavigationDrawer: ["AppShell.tsx", "PublicShell.tsx"],
        },
      ],
    },
  },
  {
    files: JSX,
    rules: {
      "stapel/no-hardcoded-text": "error",
      // Clickable-without-an-outcome is a JSX concern (§3.2).
      "stapel/clickable-needs-event": "error",
      // antd 6's Alert rename. Not a doctrine rule — a vendor deprecation
      // whose every site is `message` → `title`, autofixed, so it ships at
      // ERROR straight away instead of joining the worklist tier.
      "stapel/antd-alert-title": "error",
    },
  },
  {
    // The doctrine tier, at WARN — a worklist, not a wall (see DOCTRINE_LEVEL).
    files: TS_JS,
    rules: doctrineRules(DOCTRINE_TS, DOCTRINE_LEVEL),
  },
  {
    files: JSX,
    rules: doctrineRules(DOCTRINE_JSX, DOCTRINE_LEVEL),
  },
  {
    files: RAW_ALLOWED,
    rules: { "stapel/no-raw-token-import": "off" },
  },
  {
    files: FETCH_ALLOWED,
    rules: { "stapel/no-raw-fetch": "off" },
  },
  {
    files: PATHS_ALLOWED,
    rules: { "stapel/no-string-paths": "off" },
  },
  {
    files: KEY_FACTORY,
    rules: { "stapel/query-keys-from-factory": "off" },
  },
  {
    // Core's storage/repository internals — the one legal home of raw
    // storage access (§43.4 override).
    files: STORAGE_ALLOWED,
    rules: { "stapel/no-raw-storage": "off" },
  },
  {
    // Core's client + session — the one legal home of 401 handling
    // (§43.2 override).
    files: ADHOC_401_ALLOWED,
    rules: { "stapel/no-adhoc-401": "off" },
  },
  {
    // The transport/error layer — the one legal home of the raw envelope
    // shape (it is the code that folds it into `StapelApiError`).
    files: ERROR_LAYER_ALLOWED,
    rules: { "stapel/no-raw-error-shape": "off" },
  },
  {
    // The api/transport layer — where `const { data } = await client.GET(…)`
    // is openapi-fetch's raw result half and defaulting it is part of folding
    // the response, not a rendering decision. Same carve-out shape, and the
    // same reason, as `no-raw-fetch`/`no-raw-error-shape`.
    files: LOAD_STATE_ALLOWED,
    rules: { "stapel/no-flattened-load-state": "off" },
  },
  {
    // The dialog SUBSTRATE — the one legal home of antd's `Modal`/`Drawer`.
    // `SkinDialog` is what every other file is told to render instead, and it
    // has to be built out of something. Same carve-out shape, and the same
    // reason, as `no-raw-fetch` in the api layer.
    files: DIALOG_SUBSTRATE,
    rules: { "stapel/no-bare-dialog": "off" },
  },
  {
    // The facade's provider adapters — the ONE legal home of vendor SDK
    // imports (§2.2 override; mirrors the FETCH_ALLOWED api-layer carve-out).
    files: ["**/analytics/providers.{ts,js}", "**/analytics/src/providers.{ts,js}", "**/analytics/providers/**"],
    rules: { "stapel/no-direct-analytics-provider": "off" },
  },
  {
    files: TEST_FILES,
    rules: {
      "stapel/no-raw-colors": "off",
      "stapel/valid-token-name": "off",
      "stapel/no-hardcoded-text": "off",
      "stapel/i18n-key-exists": "off",
      "stapel/no-raw-fetch": "off",
      "stapel/no-string-paths": "off",
      "stapel/query-keys-from-factory": "off",
      "stapel/no-raw-token-import": "off",
      // Fixtures / headless test factories legitimately train the analytics
      // anti-patterns (dynamic defineEvent, deliberate double-count, unknown
      // events, un-tracked clickables) — off there, on in product/demos.
      "stapel/clickable-needs-event": "off",
      "stapel/event-literal-meta": "off",
      "stapel/no-double-count": "off",
      "stapel/known-event": "off",
      "stapel/no-direct-analytics-provider": "off",
      "stapel/demo-literal-meta": "off",
      // Tests legitimately assert on raw storage state (the wipe-at-logout
      // contract test greps localStorage directly) and on 401 fixtures.
      "stapel/no-raw-storage": "off",
      "stapel/no-adhoc-401": "off",
      // Fixtures deliberately construct un-narrowed/raw error shapes — that
      // is what an envelope-dialect test IS (including this rule's own).
      "stapel/no-raw-error-shape": "off",
      // A load-state fixture's job is to BE the flattened shape.
      "stapel/no-flattened-load-state": "off",
      // Route fixtures legitimately probe reserved-path collisions on purpose
      // (that's what this rule's own tests do).
      "stapel/no-reserved-backend-route": "off",
      // The doctrine tier is off in tests for the SAME reason the content
      // rules are: a fixture's job is to BE the forbidden shape — a socket
      // test constructs a socket, a skin test renders an unlabelled button
      // and a hardcoded padding on purpose. (`no-adhoc-socket` also carves
      // test paths out inside the rule, so a consumer who never spreads this
      // block still gets the right answer.) The script canon stays absent
      // from this list, as above.
      ...doctrineRules([...DOCTRINE_TS, ...DOCTRINE_JSX], "off"),
      // require-disable-description stays ON — disable hygiene applies everywhere.
      //
      // no-cyrillic-source / no-mixed-script-word are DELIBERATELY ABSENT
      // from this block (owner ruling 2026-08-09, second pass). 0.7.0 turned
      // both off here so this plugin's own fixtures — which must contain
      // Cyrillic and homoglyph words, that being what a script-canon rule's
      // test suite IS — would lint clean. The cost was a blanket exemption
      // every consumer inherited on every test file, and test files are
      // exactly where the canon leaks: meettoday's sweep reported 5603 → 0
      // and still had 15 live hits in one `.test.ts` the gate was skipping.
      // The Python half of the same canon (stapel-tools R010/R011) runs ON
      // test files for precisely that reason — Russian identifiers were
      // thickest there, and pytest prints those names. The two halves now
      // agree. This plugin's own fixture problem is solved where it belongs,
      // in the two fixture files themselves, with a scoped file-level
      // `eslint-disable … -- reason` (see test/no-cyrillic-source.test.js
      // and test/no-mixed-script-word.test.js) — a mechanism that costs
      // consumers nothing.
    },
  },
];

/**
 * Flat-config `strict` preset — `recommended` with the doctrine tier at ERROR
 * and the confirm surface covered. Spread INSTEAD of `recommended`:
 *
 *   export default [ ...tseslint.configs.strict, ...stapel.configs.strict ];
 *
 * A package opts in when its migrations have landed; after that a regression
 * fails its own `pnpm lint` instead of adding a line to somebody's worklist.
 * Built by APPENDING to `recommended` rather than by rebuilding it, so the two
 * presets can never disagree about a carve-out — the failure mode that made
 * the 0.7.0 test-glob hole invisible.
 */
const strict = [
  ...recommended,
  {
    files: TS_JS,
    rules: doctrineRules(DOCTRINE_TS, "error"),
  },
  {
    files: JSX,
    rules: {
      ...doctrineRules(DOCTRINE_JSX, "error"),
      // The full dialog surface — Modal, Drawer AND Popconfirm — as an ERROR
      // on every file, not just the skins. This is what a product repo arms
      // when it wants the doctrine to be a gate rather than a worklist.
      "stapel/no-bare-dialog": [
        "error",
        { allowNavigationDrawer: ["AppShell.tsx", "PublicShell.tsx"] },
      ],
    },
  },
  {
    // Re-assert the fixture carve-outs, which the two blocks above would
    // otherwise have switched back on for test files.
    files: TEST_FILES,
    rules: doctrineRules([...DOCTRINE_TS, ...DOCTRINE_JSX], "off"),
  },
  {
    // Same for the dialog substrate: the block above re-arms no-bare-dialog
    // on every JSX file, and the file that BUILDS SkinDialog is the one that
    // must import antd's Modal and Drawer.
    files: DIALOG_SUBSTRATE,
    rules: { "stapel/no-bare-dialog": "off" },
  },
];

plugin.configs = { recommended, strict };

export default plugin;
export { rules, recommended, strict };
