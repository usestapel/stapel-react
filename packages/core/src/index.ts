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

// query layer + persistence
export { createStapelQueryClient } from "./query.js";
export type {
  StapelQueryRuntime,
  StapelQueryClientOptions,
  PersistStorage,
} from "./query.js";

// i18n engine
export { createI18n, interpolate, I18nProvider, useI18n, useT } from "./i18n.js";
export type {
  I18nEngine,
  I18nDictionary,
  LocaleLoader,
  TranslateFn,
  CreateI18nOptions,
} from "./i18n.js";

// breakpoints
export { useBreakpoint } from "./useBreakpoint.js";
export type { Breakpoint } from "@stapel/tokens";
