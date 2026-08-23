import { describe, expect, it } from "vitest";
import { StapelApiError } from "@stapel/core";
import {
  isAccountClosed,
  isCaptchaRefusal,
  isClosureAlreadyPending,
  isClosureUnavailable,
  isDownloadConsumed,
  isDownloadExpired,
  isDsarNotFound,
  isErasureForbidden,
  isErasureNotFound,
  isExportCooldown,
  isExportNotFound,
  isExportNotReady,
  isLegalHold,
  isNoActiveClosure,
  isStaffOnly,
  isUnknownDsarKind,
  isUnknownSubjectType,
} from "../src/index.js";

/**
 * The rule this whole package is built on: **a refusal is read by CODE, never
 * by status.** stapel-gdpr answers three different 404s, two different 409s and
 * two different 410s, and in two of those cases the 404 is not a failure at
 * all. Every test below is a pair of codes that a status check would confuse.
 */
const err = (code: string, status: number): StapelApiError =>
  new StapelApiError({ code, status, message: code, params: {} });

const NO_ACTIVE_CLOSURE = err("error.404.gdpr.no_active_closure", 404);
const EXPORT_NOT_FOUND = err("error.404.gdpr.export_not_found", 404);
const ERASURE_NOT_FOUND = err("error.404.gdpr.erasure_not_found", 404);
const DSAR_NOT_FOUND = err("error.404.gdpr.dsar_not_found", 404);
const CLOSURE_PENDING = err("error.409.gdpr.closure_already_pending", 409);
const LEGAL_HOLD = err("error.409.gdpr.legal_hold", 409);
const EXPORT_COOLDOWN = err("error.409.gdpr.export_cooldown", 409);
const DOWNLOAD_CONSUMED = err("error.410.gdpr.download_consumed", 410);
const DOWNLOAD_EXPIRED = err("error.410.gdpr.download_expired", 410);
const NOT_READY = err("error.425.gdpr.export_not_ready", 425);
const ERASURE_FORBIDDEN = err("error.403.gdpr.erasure_forbidden", 403);
const ACCOUNT_CLOSED = err("error.403.gdpr.account_closed", 403);
const FORBIDDEN = err("error.403.forbidden", 403);
const UNKNOWN_SUBJECT = err("error.400.gdpr.unknown_subject_type", 400);
const UNKNOWN_KIND = err("error.400.gdpr.unknown_dsar_kind", 400);
const CAPTCHA_INVALID = err("error.400.captcha_invalid", 400);
const CAPTCHA_REQUIRED = err("error.400.captcha_required", 400);
const CLOSURE_UNAVAILABLE = err("error.503.gdpr.closure_unavailable", 503);

describe("three 404s, three different meanings", () => {
  it("'nothing is being deleted' is not 'no such export' and not 'no such erasure'", () => {
    expect(isNoActiveClosure(NO_ACTIVE_CLOSURE)).toBe(true);
    expect(isNoActiveClosure(EXPORT_NOT_FOUND)).toBe(false);
    expect(isNoActiveClosure(ERASURE_NOT_FOUND)).toBe(false);
    expect(isNoActiveClosure(DSAR_NOT_FOUND)).toBe(false);
  });

  it("'you have no archive' is its own answer", () => {
    expect(isExportNotFound(EXPORT_NOT_FOUND)).toBe(true);
    expect(isExportNotFound(NO_ACTIVE_CLOSURE)).toBe(false);
  });

  it("the two real misses stay real misses", () => {
    expect(isErasureNotFound(ERASURE_NOT_FOUND)).toBe(true);
    expect(isErasureNotFound(NO_ACTIVE_CLOSURE)).toBe(false);
    expect(isDsarNotFound(DSAR_NOT_FOUND)).toBe(true);
    expect(isDsarNotFound(ERASURE_NOT_FOUND)).toBe(false);
  });
});

describe("two 409s: a no-op and a legal refusal", () => {
  it("'already pending' is absorbed, 'legal hold' is explained", () => {
    expect(isClosureAlreadyPending(CLOSURE_PENDING)).toBe(true);
    expect(isClosureAlreadyPending(LEGAL_HOLD)).toBe(false);
    expect(isLegalHold(LEGAL_HOLD)).toBe(true);
    expect(isLegalHold(CLOSURE_PENDING)).toBe(false);
  });

  it("the export cooldown is a third 409 and neither of the other two", () => {
    expect(isExportCooldown(EXPORT_COOLDOWN)).toBe(true);
    expect(isLegalHold(EXPORT_COOLDOWN)).toBe(false);
    expect(isClosureAlreadyPending(EXPORT_COOLDOWN)).toBe(false);
  });
});

describe("two 410s, opposite advice", () => {
  it("'already used' and 'expired' never answer for each other", () => {
    // consumed → the archive was served and deleted; look in your downloads.
    // expired  → it was never taken; ask again.
    expect(isDownloadConsumed(DOWNLOAD_CONSUMED)).toBe(true);
    expect(isDownloadConsumed(DOWNLOAD_EXPIRED)).toBe(false);
    expect(isDownloadExpired(DOWNLOAD_EXPIRED)).toBe(true);
    expect(isDownloadExpired(DOWNLOAD_CONSUMED)).toBe(false);
  });

  it("425 'not ready' is neither — it means wait", () => {
    expect(isExportNotReady(NOT_READY)).toBe(true);
    expect(isDownloadConsumed(NOT_READY)).toBe(false);
    expect(isDownloadExpired(NOT_READY)).toBe(false);
  });
});

describe("three 403s: an authorizer, a closed account, and 'not staff'", () => {
  it("tells the host's ownership refusal from the account being erased", () => {
    expect(isErasureForbidden(ERASURE_FORBIDDEN)).toBe(true);
    expect(isErasureForbidden(ACCOUNT_CLOSED)).toBe(false);
    expect(isAccountClosed(ACCOUNT_CLOSED)).toBe(true);
    expect(isAccountClosed(ERASURE_FORBIDDEN)).toBe(false);
  });

  it("the generic staff refusal is the cross-cutting core code", () => {
    // `GET /dsar` is AllowAny at the view level (its POST must accept an
    // anonymous form), so the staff check is hand-rolled and comes back as
    // core's generic key rather than a `gdpr.*` one.
    expect(isStaffOnly(FORBIDDEN)).toBe(true);
    expect(isStaffOnly(ERASURE_FORBIDDEN)).toBe(false);
    expect(isErasureForbidden(FORBIDDEN)).toBe(false);
  });
});

describe("the 400 vocabulary refusals, and the captcha", () => {
  it("an unknown subject type is not an unknown DSAR kind", () => {
    expect(isUnknownSubjectType(UNKNOWN_SUBJECT)).toBe(true);
    expect(isUnknownSubjectType(UNKNOWN_KIND)).toBe(false);
    expect(isUnknownDsarKind(UNKNOWN_KIND)).toBe(true);
    expect(isUnknownDsarKind(UNKNOWN_SUBJECT)).toBe(false);
  });

  it("both captcha keys are one recovery for the anonymous form", () => {
    expect(isCaptchaRefusal(CAPTCHA_INVALID)).toBe(true);
    expect(isCaptchaRefusal(CAPTCHA_REQUIRED)).toBe(true);
    expect(isCaptchaRefusal(UNKNOWN_KIND)).toBe(false);
  });
});

describe("503 is the deployment, not the request", () => {
  it("a closure refused because sessions cannot be revoked is its own state", () => {
    // Deliberately not a 500: the request was fine, the deployment is
    // misconfigured, and closing an account whose live tokens keep working is
    // not an acceptable degraded mode.
    expect(isClosureUnavailable(CLOSURE_UNAVAILABLE)).toBe(true);
    expect(isClosureUnavailable(LEGAL_HOLD)).toBe(false);
  });
});

describe("a fault that is none of the module's refusals says so", () => {
  it.each([
    ["a dropped connection", new TypeError("Failed to fetch")],
    ["a string", "boom"],
    ["undefined", undefined],
  ])("%s matches no predicate", (_name, value) => {
    for (const predicate of [
      isNoActiveClosure,
      isExportNotFound,
      isLegalHold,
      isDownloadConsumed,
      isDownloadExpired,
      isErasureForbidden,
      isStaffOnly,
      isCaptchaRefusal,
    ]) {
      expect(predicate(value)).toBe(false);
    }
  });
});
