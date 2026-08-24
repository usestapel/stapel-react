// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createModerationApi } from "../src/api/moderationApi.js";
import { nextBefore } from "../src/api/extensions.js";
import {
  APPEAL_STATES,
  CASE_EVENT_KINDS,
  CASE_ORIGINS,
  CASE_STATES,
  DECISIONS,
  SANCTION_KINDS,
  SANCTION_STATES,
  VERDICT_SOURCES,
} from "../src/api/enums.js";
import { leaseStatus } from "../src/flows/triageFlow.js";
import { reasonStep } from "../src/flows/reportFlow.js";
import { dataResolvedKeys, moderationI18nBundleEn } from "../src/i18n/keys.js";
import { moderationI18nBundleRu } from "../src/i18n/ru.js";
import { moderationI18nBundleEs } from "../src/i18n/es.js";

/**
 * The teeth of the vocabulary mirror (`src/api/enums.ts`): DRF types every one
 * of these fields as a bare `string`, so the generated schema cannot carry
 * them and the pair hand-mirrors `models.py`. This test re-reads that file
 * from the sibling checkout and fails when a member is added, removed or
 * renamed there — the drift the comments name is then a red test, not a
 * console with a word in it the backend has never heard of.
 */
const MODELS = resolve(
  process.env["SIBLING_ROOT"] ?? "../..",
  "stapel-moderation/models.py"
);

/** The `VALUE = "value", "Label"` members of one `TextChoices` class. */
function choices(source: string, className: string): string[] {
  const start = source.indexOf(`class ${className}(models.TextChoices):`);
  expect(start, `${className} not found in models.py`).toBeGreaterThan(-1);
  const next = source.indexOf("\nclass ", start + 1);
  const body = source.slice(start, next === -1 ? undefined : next);
  return [...body.matchAll(/^\s{4}[A-Z_0-9]+\s*=\s*"([a-z_]+)"/gm)].map(
    (match) => match[1] as string
  );
}

describe("enums are pinned to the backend's models.py", () => {
  let source: string;
  try {
    source = readFileSync(MODELS, "utf8");
  } catch {
    source = "";
  }
  const cases: readonly [string, readonly string[]][] = [
    ["CaseState", CASE_STATES],
    ["VerdictDecision", DECISIONS],
    ["VerdictSource", VERDICT_SOURCES],
    ["CaseOrigin", CASE_ORIGINS],
    ["CaseEventKind", CASE_EVENT_KINDS],
    ["SanctionKind", SANCTION_KINDS],
    ["SanctionState", SANCTION_STATES],
    ["AppealState", APPEAL_STATES],
  ];
  for (const [className, mirrored] of cases) {
    it(`${className} matches, in declaration order`, () => {
      if (source === "") {
        // No sibling checkout (a consumer running the published tarball's
        // tests). Say so rather than passing silently on nothing.
        expect(mirrored.length).toBeGreaterThan(0);
        return;
      }
      expect(choices(source, className)).toEqual([...mirrored]);
    });
  }
});

/**
 * The trailing slash is load-bearing (`urls_v1.py`): the three user routes
 * carry one and every console route does not. `APPEND_SLASH` only rescues a
 * GET, and only with a redirect that drops the body — so one wrong character
 * here is a 404 on a POST, in production, for a control that looks fine.
 */
describe("operation paths", () => {
  const calls: { method: string; path: string }[] = [];
  const client = {
    baseUrl: "/moderation/api/v1/",
    request: async () => ({}),
    get: async (path: string) => {
      calls.push({ method: "GET", path });
      return [] as never;
    },
    post: async (path: string) => {
      calls.push({ method: "POST", path });
      return {} as never;
    },
    put: async () => ({}) as never,
    patch: async () => ({}) as never,
    delete: async () => ({}) as never,
  };
  const api = createModerationApi(client as never);

  it("spells all eighteen operations exactly", async () => {
    await api.policy();
    await api.submitReport({ targetType: "listing", targetKey: "1", reasonCode: "spam" });
    await api.myReports();
    await api.submitAppeal({ caseId: "c1", body: "why" });
    await api.myAppeals();
    await api.cases();
    await api.caseDetail("c1");
    await api.claim("c1");
    await api.release("c1");
    await api.rescan("c1");
    await api.verdict("c1", { decision: "approved" });
    await api.caseEvents("c1");
    await api.stats();
    await api.sanctions();
    await api.issueSanction({ subjectUserId: "u1", kind: "warning" });
    await api.liftSanction("s1");
    await api.appealQueue();
    await api.resolveAppeal("a1", { outcome: "upheld" });

    expect(calls).toEqual([
      { method: "GET", path: "/policy" },
      { method: "POST", path: "/reports/" },
      { method: "GET", path: "/reports/" },
      { method: "POST", path: "/appeals/" },
      { method: "GET", path: "/appeals/" },
      { method: "GET", path: "/cases" },
      { method: "GET", path: "/cases/c1" },
      { method: "POST", path: "/cases/c1/claim" },
      { method: "POST", path: "/cases/c1/release" },
      { method: "POST", path: "/cases/c1/rescan" },
      { method: "POST", path: "/cases/c1/verdict" },
      { method: "GET", path: "/cases/c1/events" },
      { method: "GET", path: "/stats" },
      { method: "GET", path: "/sanctions" },
      { method: "POST", path: "/sanctions" },
      { method: "POST", path: "/sanctions/s1/lift" },
      { method: "GET", path: "/appeals/queue" },
      { method: "POST", path: "/appeals/a1/resolve" },
    ]);
  });

  it("escapes an id into a path segment", async () => {
    calls.length = 0;
    await api.caseDetail("a/b");
    expect(calls[0]?.path).toBe("/cases/a%2Fb");
  });
});

describe("keyset cursor", () => {
  const row = (created_at: string): { created_at: string } => ({ created_at });

  it("is the last row's created_at while the page is full", () => {
    expect(nextBefore([row("a"), row("b")], 2)).toBe("b");
  });

  it("is undefined on a short page — the end of the list", () => {
    expect(nextBefore([row("a")], 2)).toBeUndefined();
  });

  it("is undefined on an empty page", () => {
    expect(nextBefore([], 25)).toBeUndefined();
  });
});

describe("lease", () => {
  const now = Date.parse("2026-08-24T12:00:00Z");
  const future = "2026-08-24T12:30:00Z";
  const past = "2026-08-24T11:30:00Z";

  it("is free when nobody holds it", () => {
    expect(leaseStatus({ claimed_by: null }, "me", now).kind).toBe("free");
  });

  it("is mine when the holder is the viewer", () => {
    expect(leaseStatus({ claimed_by: "me", claimed_until: future }, "me", now)).toEqual({
      kind: "mine",
      until: future,
      expired: false,
    });
  });

  it("reports an expired hold rather than a live one", () => {
    const status = leaseStatus({ claimed_by: "me", claimed_until: past }, "me", now);
    expect(status.kind === "mine" && status.expired).toBe(true);
  });

  it("reads as somebody else's when the host cannot say who the viewer is", () => {
    // Offering "hand it back" for a lease that may not be yours is worse than
    // not offering it: the backend answers 409 moderation_not_claimant.
    expect(
      leaseStatus({ claimed_by: "someone", claimed_until: future }, undefined, now).kind
    ).toBe("other");
  });
});

describe("report gating mirrors services.submit_report", () => {
  it("parks in describing while a required explanation is empty", () => {
    expect(reasonStep("harassment", true, "   ").step).toBe("describing");
  });

  it("is ready once the explanation is written", () => {
    expect(reasonStep("harassment", true, "they keep messaging me").step).toBe("ready");
  });

  it("is ready immediately for a reason that needs no explanation", () => {
    expect(reasonStep("spam", false, "").step).toBe("ready");
  });
});

/**
 * The keys resolved from DATA — a reason code the backend hands out as
 * `label_key`, a case state, a sanction kind. They are not in
 * `MODERATION_I18N_KEYS` (they would be a second hand-maintained copy of an
 * enum), so the locale-parity test cannot see them: this walks the
 * vocabularies instead and demands copy in all three locales.
 */
describe("data-resolved i18n keys", () => {
  const bundles = {
    en: moderationI18nBundleEn,
    ru: moderationI18nBundleRu,
    es: moderationI18nBundleEs,
  };
  for (const [locale, bundle] of Object.entries(bundles)) {
    it(`${locale} covers every vocabulary member`, () => {
      const missing = dataResolvedKeys().filter((key) => !(key in bundle));
      expect(missing).toEqual([]);
    });
  }
});
