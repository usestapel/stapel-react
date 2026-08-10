import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "../src/i18n.js";
import {
  ACTION_BLOCKED_LOADING,
  actionAvailable,
  actionBlocked,
  actionBlockedByFailure,
  firstBlock,
  requireLoaded,
  useActionGate,
} from "../src/actionGate.js";
import type { ActionAvailability } from "../src/actionGate.js";
import { loadFailed, loadLoading, loadReady } from "../src/loadState.js";
import { StapelApiError } from "../src/errors.js";

function wrapperFor(
  locale: string,
  bundles: Record<string, Record<string, string>> = {}
) {
  const i18n = createI18n({ locale, bundles });
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <I18nProvider i18n={i18n}>{props.children}</I18nProvider>;
  };
}

function gateFor(
  availability: ActionAvailability,
  locale = "en",
  bundles: Record<string, Record<string, string>> = {}
) {
  const { result } = renderHook(() => useActionGate(availability), {
    wrapper: wrapperFor(locale, bundles),
  });
  return result.current;
}

const NOT_FOUND = new StapelApiError({
  code: "stapel.http.404",
  message: "Request failed with status 404",
  status: 404,
});

describe("useActionGate", () => {
  it("leaves an available action enabled and silent", () => {
    const gate = gateFor(actionAvailable());
    expect(gate).toEqual({ disabled: false, reason: undefined, detail: undefined });
  });

  it("disables with a readable sentence — never a bare grey button", () => {
    const gate = gateFor(actionBlockedByFailure(NOT_FOUND));
    expect(gate.disabled).toBe(true);
    expect(gate.reason).toBe(
      "We could not load what this needs. Reload the page to try again."
    );
  });

  it("never says the dependency is absent when it merely failed to load", () => {
    // `stapel.http.404` reads "This is no longer available." — true of a
    // deleted thing, a lie about a mis-mounted route, and the exact assertion
    // tracker #211 objects to. The block copy must not reuse it.
    const gate = gateFor(actionBlockedByFailure(NOT_FOUND));
    expect(gate.reason).not.toBe("This is no longer available.");
    expect(gate.reason).not.toMatch(/no longer available|you have (no|none)/i);
  });

  it("puts the protocol number in the detail line, not in the sentence", () => {
    const gate = gateFor(actionBlockedByFailure(NOT_FOUND));
    expect(gate.reason).not.toMatch(/404/);
    expect(gate.detail).toBe("HTTP 404");
  });

  it("translates the reason through the host's locale", () => {
    const gate = gateFor(actionBlockedByFailure(NOT_FOUND), "ru");
    expect(gate.reason).toBe(
      "Не удалось загрузить то, что нужно для этого действия. Обновите страницу и попробуйте ещё раз."
    );
  });

  it("interpolates a pair's own block copy", () => {
    const gate = gateFor(
      actionBlocked("recordings.upload.blocked.quota", { limit: 5 }),
      "en",
      { en: { "recordings.upload.blocked.quota": "You have used all {limit} uploads." } }
    );
    expect(gate.reason).toBe("You have used all 5 uploads.");
    // A rule, not a fault — nothing for support to quote.
    expect(gate.detail).toBeUndefined();
  });
});

describe("requireLoaded", () => {
  it("blocks while loading, and says so rather than saying nothing", () => {
    const availability = requireLoaded(loadLoading(), () => actionAvailable());
    expect(availability.available).toBe(false);
    expect(availability.block?.code).toBe(ACTION_BLOCKED_LOADING);
    expect(gateFor(availability).reason).toBe("Still loading. One moment.");
  });

  it("blocks on failure with the failure attached", () => {
    const availability = requireLoaded(loadFailed(NOT_FOUND), () => actionAvailable());
    expect(availability.available).toBe(false);
    expect(availability.block?.cause?.status).toBe(404);
  });

  it("hands the ready data to the caller's own rule", () => {
    const rule = (rows: readonly string[]): ActionAvailability =>
      rows.length === 0 ? actionBlocked("app.upload.no_workspace") : actionAvailable();
    expect(requireLoaded(loadReady<readonly string[]>(["w"]), rule).available).toBe(true);
    const empty = requireLoaded(loadReady<readonly string[]>([]), rule);
    expect(empty.available).toBe(false);
    expect(empty.block?.code).toBe("app.upload.no_workspace");
  });

  it("distinguishes 'you have none' from 'we could not find out'", () => {
    // The whole incident in four lines. Both end with a disabled button; they
    // must not end with the same sentence under it.
    const rule = (rows: readonly string[]): ActionAvailability =>
      rows.length === 0 ? actionBlocked("app.upload.no_workspace") : actionAvailable();
    const genuinelyEmpty = requireLoaded(loadReady<readonly string[]>([]), rule);
    const couldNotAsk = requireLoaded(loadFailed(NOT_FOUND), rule);
    expect(genuinelyEmpty.block?.code).not.toBe(couldNotAsk.block?.code);
  });
});

describe("firstBlock", () => {
  it("reports the first stated reason and stays available when none block", () => {
    expect(firstBlock(actionAvailable(), actionAvailable()).available).toBe(true);
    const combined = firstBlock(
      actionAvailable(),
      actionBlocked("a.first"),
      actionBlocked("a.second")
    );
    expect(combined.block?.code).toBe("a.first");
  });
});
