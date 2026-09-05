// fetch + error envelope
export { createStapelClient } from "./client.js";
export type {
  StapelClient,
  StapelClientOptions,
  StapelRequestOptions,
  HttpMethod,
} from "./client.js";
export { StapelApiError, parseErrorEnvelope } from "./errors.js";
export type { StapelErrorEnvelope } from "./errors.js";
// One dialect: narrow a caught value through these, never through a cast
// (`stapel/no-raw-error-shape`). `toStapelApiError` is the wrap a second
// transport applies at its single rethrow point so call sites only ever see
// `StapelApiError`. See errors.ts "One dialect".
export {
  isStapelApiError,
  isErrorEnvelope,
  errorCode,
  errorStatus,
  hasErrorCode,
  errorCodePredicate,
  toStapelApiError,
  TRANSPORT_ERROR_CODE,
} from "./errors.js";

// load state: the absence of a result is not a result (loadState.ts). The
// discriminated shape every read hook hands a skin, plus the exhaustive
// `matchList` a skin renders it with — four required arms, so "empty" and
// "failed" cannot share a branch. `stapel/no-flattened-load-state`
// (@stapel/eslint-plugin) bans the `query.data ?? []` shape it replaces.
export {
  loadLoading,
  loadReady,
  loadFailed,
  isLoadLoading,
  isLoadReady,
  isLoadFailed,
  loadStateFromQuery,
  mapLoad,
  bothLoaded,
  matchLoad,
  matchList,
  loadedRowsOrEmpty,
} from "./loadState.js";
export type {
  LoadState,
  LoadLoading,
  LoadReady,
  LoadFailed,
  NonEmptyArray,
  QueryLike,
} from "./loadState.js";

// action gate: a disabled control states its reason (actionGate.ts). There is
// no way to spell "blocked, reason unknown" — the union has no such member.
export {
  actionAvailable,
  actionBlocked,
  actionBlockedByFailure,
  requireLoaded,
  firstBlock,
  useActionGate,
  ACTION_BLOCKED_LOADING,
  ACTION_BLOCKED_LOAD_FAILED,
} from "./actionGate.js";
export type {
  ActionAvailability,
  ActionBlock,
  ActionGateView,
} from "./actionGate.js";

// host seams a skin needs but a library must not choose (ui.ts): the host's
// `<Link>` (so category chrome and a listing card navigate inside the SPA
// instead of reloading it) and the sign-in door a blocked control points at
// (so `actionBlocked`'s reason comes with its next action). Types only — no
// runtime, no router, no antd.
export type {
  LinkComponent,
  LinkComponentProps,
  SignInCta,
  SignInCtaProp,
} from "./ui.js";

// verification-403 interception seam
export {
  extractVerificationChallenge,
  VERIFICATION_TOKEN_HEADER,
} from "./verification.js";
export type {
  VerificationChallenge,
  VerificationOutcome,
  VerificationChallengeHandler,
} from "./verification.js";

// config provider + client injection
export {
  StapelConfigProvider,
  useStapelConfig,
  useStapelClient,
} from "./config.js";
export type { StapelConfig } from "./config.js";

// one-provider setup (slim wave §21/S4): StapelConfigProvider +
// QueryClientProvider + I18nProvider in one component. The individual
// providers stay exported below — composition, not deprecation.
export { StapelProvider } from "./provider.js";
export type { StapelProviderProps } from "./provider.js";

// query layer + persistence
export { createStapelQueryClient, createMeCachePersister } from "./query.js";
export type {
  StapelQueryRuntime,
  StapelQueryClientOptions,
  PersistStorage,
  MeCachePersister,
  MeCachePersisterOptions,
} from "./query.js";

// i18n engine
export {
  createI18n,
  interpolate,
  pluralCategory,
  I18nProvider,
  useI18n,
  useOptionalI18n,
  useT,
  useTPlural,
} from "./i18n.js";
export type {
  I18nEngine,
  I18nDictionary,
  LocaleLoader,
  PluralCategory,
  PluralTranslateFn,
  TranslateFn,
  CreateI18nOptions,
} from "./i18n.js";

// i18n formatters (i18n/format.ts): dates, relative times, durations and
// numbers at the APP's locale rather than the browser's. The ONE home for the
// `src/model/format.ts` sixteen pairs each wrote for themselves — see that
// module's header for what is deliberately not here (money, bytes, sentences).
export {
  formatDate,
  formatDateTime,
  formatRelative,
  formatDuration,
  formatNumber,
  createFormat,
  useFormat,
  toDate,
} from "./i18n/format.js";
export type {
  Format,
  Instant,
  RelativeOptions,
  DurationStyle,
} from "./i18n/format.js";

// analytics TYPE seam + context plumbing (analytics-standard §2). The facade
// IMPLEMENTATION (createAnalytics, the console/Stapel-collector providers,
// defineEvent/prop, tracked/useTracked) lives in `@stapel/analytics`
// (slim-wave §21/S1): pairs thread the `Analytics` seam through context and
// depend only on core; hosts pick @stapel/analytics (the stapel-studio
// default) or bring their own provider behind the same seam.
export { trackFlowStep } from "./analytics/flow.js";
export type { FlowStepPhase } from "./analytics/flow.js";
export { AnalyticsContext, useAnalytics } from "./analytics/context.js";
export type {
  EventDef,
  EventDefInput,
  EventProps,
  AnyEventDef,
  PropSpec,
  PropsSchema,
  PropType,
  ResolveProps,
} from "./analytics/events.js";
export type {
  Analytics,
  AnalyticsEvent,
  AnalyticsEventKind,
  AnalyticsProvider,
  AnalyticsOptions,
  AnalyticsBatchOptions,
  ConsentState,
  PiiGuardMode,
} from "./analytics/types.js";

// persistence adapters — shared by the query layer and @stapel/analytics'
// offline queue (the impl package builds on these rather than re-implementing
// the IndexedDB → localStorage → memory ladder).
export {
  defaultPersistStorage,
  idbStorage,
  localStorageAdapter,
  memoryStorage,
} from "./storage.js";

// recency (useRecents.ts): the codes a person picked last, per scope, most
// recent first. Headless on purpose — "the four makes you last chose on top of
// the list" is the same product rule in an attributes ref editor, a vocabulary
// term control and (next) a search facet, so it cannot live in any one of them
// and must not live in the antd bridge either. Persisted through the
// PersistStorage ladder above; never throws when storage is unavailable.
export { useRecents, recentsStorageKey, RECENTS_DEFAULT_MAX, RECENTS_KEY_PREFIX } from "./useRecents.js";
export type { RecentsBag, UseRecentsOptions } from "./useRecents.js";

// session substrate (frontend-core-architecture-v2 §43.1–§43.3): status,
// single-flight refresh, the logout-hook registry, the per-session
// encryption key `createRepository` uses. An authenticating module (today:
// @stapel/auth-react) owns tokens and the refresh mechanics; SessionManager
// owns the generic lifecycle around them.
export {
  createSessionManager,
  getActiveSessionManager,
  REFRESH_UNAVAILABLE,
  REFRESH_INFLIGHT_MARKER_KEY,
  REFRESH_HANDOFF_WINDOW_MS,
} from "./session.js";
export type {
  SessionManager,
  SessionStatus,
  RefreshOutcome,
  SessionLostReason,
  SessionLogoutReason,
  LogoutHook,
  CreateSessionManagerOptions,
  SessionManagerEventMap,
  SessionEventName,
} from "./session.js";
export {
  useSessionReady,
  useActiveSessionReady,
  useActiveSessionStatus,
} from "./useSessionReady.js";

// repositories (§43.4) — the one sanctioned client-side persistence
// primitive. `scope: "user"` auto-wipes on logout (no opt-out) and is
// encrypted by default (§43.5 — WebCrypto AES-GCM, honest boundaries in the
// package README: at-rest defense only, not an XSS mitigation).
export { createRepository } from "./repository.js";
export type { Repository, RepositoryOptions } from "./repository.js";

// module-pair plumbing factories (slim wave §21/S2) — the one reviewed copy
// of the runtime/context/provider boilerplate every standard pair binds under
// its module-prefixed names. auth-react stays bespoke (its runtime differs).
export { createModuleRuntime, createModuleContext } from "./module.js";
export type {
  ModuleRuntime,
  CreateModuleRuntimeOptions,
  ModuleContextKit,
} from "./module.js";

// breakpoints — read synchronously (useSyncExternalStore), so the first client
// render carries the real viewport; `undefined` only on the server.
export { useBreakpoint } from "./useBreakpoint.js";
export type { Breakpoint } from "@stapel/tokens";

// navigation-manifest contract (scripted-fullstack navigation Phase 1): the
// shared shape a pair's `src/nav/manifest.ts` exports and `resolveNav`
// (`@stapel/shell-react`) consumes. Pure data types — no React, no I/O.
export { navEntrySurface, navSurfaceVisibleTo } from "./nav.js";
export type {
  NavEntry,
  NavRoute,
  NavComponentRef,
  NavPlacement,
  NavPlacementLevel,
  NavSurface,
  PackageNavManifest,
} from "./nav.js";

// mandate axis (mandate.ts): anonymous / guest / member, plus the
// `"unresolved"` outcome that is NOT a principal — "we could not ask" must
// never render as "you may not". `matchMandate` takes five required arms so
// a wait cannot fall into a refusal's branch by omission.
export {
  mandateResolved,
  mandateAsking,
  mandateUnavailable,
  isMandateResolved,
  matchMandate,
} from "./mandate.js";
export type {
  MandatePrincipal,
  MandateState,
  MandateResolved,
  MandateAsking,
  MandateUnavailable,
  MandateUnresolvedReason,
} from "./mandate.js";

// mandate seam (mandateSource.tsx): the axis is PROVIDED, not computed here.
// A public surface reads it without importing the module that derives it —
// a storefront has no workspaces to ask, and pulling `workspaces-react` in
// to answer one boolean would mount the multi-tenant metaphor inside an
// anonymous marketplace.
export { MandateProvider, useMandate, useMandatePrincipal } from "./mandateSource.js";
export type { MandateSource } from "./mandateSource.js";

// elevation seam (elevation.tsx): the third answer for an anonymous visitor.
// A named action may mint an identity at the moment it is taken instead of
// refusing — never on render, once per visitor, and only for the actions a
// deployment listed. The mandate axis is untouched by it, so the actions
// that keep the wall (a review, a published listing) keep it.
export { ElevationProvider, useElevation, useElevationSource } from "./elevation.js";
export type { Elevation, ElevationSource } from "./elevation.js";

// upload primitives — the bones shared by three DIFFERENT upload contracts
// (cdn multipart / docs presign+finalize / recordings session+PUT+finalize).
// Neither knows an endpoint; the contracts stay in their own pairs.
export { putToForeignOrigin } from "./foreignOrigin.js";
export type { PutToForeignOriginOptions } from "./foreignOrigin.js";
export { useObjectUrlPreview } from "./useObjectUrlPreview.js";

// flow-machine primitive (frontend-standard §2 — the shared state container
// every `@stapel/<module>-react` pair builds its machines on; lives here, not
// copied per pair — frontend-core-architecture §4b). `useFlow` ships from core
// today and relocates to `@stapel/react` on the framework-agnostic split (§3.1).
export { createFlowMachine } from "./flows/flowMachine.js";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
} from "./flows/flowMachine.js";
export { useFlow } from "./flows/useFlow.js";
export {
  toFlowError,
  isFlowError,
  isErrorCode,
  formatFlowError,
  describeFlowError,
} from "./flows/flowError.js";
export type {
  FlowError,
  FlowErrorDisplay,
  FormatFlowErrorOptions,
} from "./flows/flowError.js";
export { useFormatFlowError, useDescribeFlowError } from "./flows/useFormatFlowError.js";
export { useErrorText, useErrorDisplay } from "./flows/useErrorText.js";
export {
  CORE_ERROR_LOCALES,
  DETAIL_ERROR_KEY,
  codeCarriesTechnicalDetail,
  coreErrorBundle,
  coreErrorKeyCandidates,
  httpStatusFloorKeys,
} from "./i18n/coreErrors.js";

// UI floor (i18n/coreUi.ts): the substrate's own copy — retry, dismiss,
// confirm, cancel, the empty-state default — under `stapel.ui.*`, seeded by
// `createI18n` in en/ru/es so `@stapel/tokens-antd/skin` renders a real
// sentence with zero host wiring. A skin reads the keys off `STAPEL_UI_KEYS`;
// a host overrides one by registering the same key later.
export {
  STAPEL_UI_KEYS,
  PERMISSION_COPY_KEYS,
  CORE_UI_LOCALES,
  coreUiBundle,
} from "./i18n/coreUi.js";

// Browser capability permissions (permission.ts): the four prompts a product
// asks for, as one state machine. Headless on purpose — the skin half
// (PermissionSheet / PermissionGate) lives in @stapel/tokens-antd/skin and
// adds no logic, so a pair with no antd still gets the states right.
export { usePermission, permissionSupported, PERMISSION_KINDS } from "./permission.js";
export type {
  PermissionKind,
  PermissionStatus,
  PermissionBag,
  UsePermissionOptions,
} from "./permission.js";

// slot placeholder (slotPlaceholder.tsx): an unfilled render slot is a visible,
// named box in development and nothing in production — never silent nothing.
// Design-system-free on purpose (tokens custom properties only), so the
// headless layer that declares a slot can also stand in for it.
export { SlotPlaceholder, isDevBuild } from "./slotPlaceholder.js";
export type { SlotPlaceholderProps } from "./slotPlaceholder.js";

// host→brand seam (site.tsx): one build, one backend, N hosts. The brand is
// resolved at RUNTIME from `GET <baseUrl>/site/` (`stapel_core.sites`), never
// baked into the image and never injected by nginx — so one container serves
// two domains under two identities. `SiteProvider` renders the container's
// `fallback` on the first frame, replaces it when the answer lands, keeps it
// when the answer never does, and reflects `data-brand`/`lang` onto `<html>`
// so scoped tokens and the accessibility tree follow without React.
export { fetchSite, SiteProvider, useSite, useOptionalSite } from "./site.js";
export type { Site, SiteBrand, SiteProviderProps } from "./site.js";

// slugify (slugify.ts): a URL-safe slug for a listing/catalogue title —
// per-word Cyrillic transliteration (Russian, Ukrainian, Belarusian,
// Kazakh), lowercase, digits kept, everything else dropped, no leading,
// trailing or doubled hyphens, cut to `maxLength` on a word boundary.
export { slugify } from "./slugify.js";
export type { SlugifyOptions } from "./slugify.js";

// NOTE: @stapel/core no longer exports a generated `paths`/`components`/
// `operations` surface. Under the §17 per-module contract pipeline every
// `@stapel/<module>-react` pair generates its OWN self-contained wire types
// (`src/api/generated/schema.ts`) from its backend's committed `docs/schema.json`
// — nothing consumed core's aggregate export (grep-confirmed), and stapel-core
// has no DRF endpoints of its own from which to emit a meaningful core slice
// (the shared `User`/`StapelError`/`TokenPairResponse` schemas only materialise
// via a module's endpoints). The hand-authored runtime error contract lives in
// `./errors.js` (`StapelApiError`, `StapelErrorEnvelope`), not the schema.
// This retired core as the last reader of the monolith aggregate (contract-pipeline.md §5).
