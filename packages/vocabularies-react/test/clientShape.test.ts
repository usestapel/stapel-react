/**
 * THE SEAM, PROVEN AT COMPILE TIME.
 *
 * `@stapel/attributes-react` declares `VocabularyClient` and this package
 * satisfies it — STRUCTURALLY, because two L2 pairs must not depend on each
 * other (attributes-v2 §3.4). Structural typing is the whole mechanism, and it
 * is also the whole risk: nothing links the two declarations, so either side
 * can rename a parameter, tighten a return type or drop `signal` and both
 * packages keep building, both suites keep passing, and the failure surfaces
 * in a storefront at the moment a person opens a listing composer.
 *
 * So the upstream declaration is TRANSCRIBED here, by hand, from
 * `packages/attributes-react/src/vocabulary.ts`, and the value this package
 * returns is assigned to it. `tsc -p tsconfig.demo.json` (the pair's `test`
 * task) type-checks this file, so a drift on either side is a red build in
 * this repo, one commit after it happens.
 *
 * The copy is deliberate duplication with a job. When it stops matching
 * upstream, this test is WRONG and must be re-transcribed — the runtime
 * assertions at the bottom exist so that a stale copy is at least a copy of
 * something that runs.
 */
import { describe, expect, it } from "vitest";
import { createVocabularyClient } from "../src/client.js";
import type { VocabularyTermPage } from "../src/client.js";
import type { TermPage } from "../src/api/types.js";

// The generated wire page must be READABLE as the seam's page. The pin is at
// stapel-vocabularies 0.2.0, so the generated `Term`/`TermPage` now declare
// `band` and `popular_count` REQUIRED — and the seam's own copies keep them
// optional, because the seam describes more than the pinned endpoint: a
// deployment older than the pin sends neither, and a host may back the seam
// with an in-memory table that has no bands at all.
//
// One-way on purpose, and that is the direction with teeth: required-to-
// optional is assignable, so a field the contract drops or renames breaks this
// line, while the seam staying broader than the wire is the whole design.
function wireReachesTheSeam(page: TermPage): VocabularyTermPage {
  return page;
}

// ── transcribed from @stapel/attributes-react src/vocabulary.ts ─────────────
// Do not import it. Do not "simplify" it. It is a photograph.

interface UpstreamVocabularyTerm {
  readonly code: string;
  readonly label: string;
  readonly has_children?: boolean;
  readonly band?: "popular" | "all";
}

interface UpstreamVocabularyTermPage {
  readonly results: readonly UpstreamVocabularyTerm[];
  readonly popular_count?: number;
  readonly total?: number;
}

type UpstreamVocabularyTermAnswer =
  | readonly UpstreamVocabularyTerm[]
  | UpstreamVocabularyTermPage;

interface UpstreamVocabularyClient {
  search(
    vocabulary: string,
    level: string,
    query: string,
    parent?: string,
    signal?: AbortSignal,
    offset?: number
  ): Promise<UpstreamVocabularyTermAnswer>;
  resolve(
    vocabulary: string,
    level: string,
    codes: readonly string[]
  ): Promise<Readonly<Record<string, string>>>;
}

// The envelope must be the SAME envelope, not merely a compatible one: a page
// this package builds has to be readable as upstream's page. A drift on either
// side is a type error on this line.
function pageReachesUpstream(page: VocabularyTermPage): UpstreamVocabularyTermPage {
  return page;
}

// ── the assertion ──────────────────────────────────────────────────────────
// A type error on this line IS the failure this file exists for.
const asUpstream: UpstreamVocabularyClient = createVocabularyClient({
  baseUrl: "https://stand.example/vocabularies/api/v1/",
});

/** The provider a container writes takes the interface, not our type — this is
 * that call site, in miniature. */
function acceptsTheSeam(client: UpstreamVocabularyClient): UpstreamVocabularyClient {
  return client;
}

describe("the vocabulary seam", () => {
  it("createVocabularyClient's result is assignable to attributes-react's VocabularyClient", () => {
    // The compiler already decided this; the runtime half asserts the copy
    // above is a copy of something that exists and has both methods.
    expect(typeof asUpstream.search).toBe("function");
    expect(typeof asUpstream.resolve).toBe("function");
    expect(acceptsTheSeam(asUpstream)).toBe(asUpstream);
  });

  it("the page envelope is the one attributes-react reads, and the wire's own", () => {
    // The compiler decided both; the runtime half keeps the transcription a
    // copy of something that exists.
    const page = pageReachesUpstream({
      results: [{ code: "apple", label: "Apple", band: "popular" }],
      popular_count: 1,
      total: 1,
    });
    expect(page.popular_count).toBe(1);
    expect(page.results[0]?.band).toBe("popular");
    // The wire row now carries the band the pin declares, and it reaches the
    // seam unchanged — the half that could only be asserted once the pin moved.
    expect(
      wireReachesTheSeam({
        results: [
          {
            code: "apple",
            label: "Apple",
            level: "Vendor",
            has_children: true,
            band: "popular",
          },
        ],
        total: 1,
        popular_count: 1,
      }).results[0]?.band
    ).toBe("popular");
  });

  it("neither package imports the other", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    // An IMPORT, not a mention: the seam is documented all over this package,
    // and a comment naming the pair it satisfies is the opposite of a
    // dependency on it.
    const importsIt = /(?:from|import)\s*\(?\s*["'][^"']*@stapel\/attributes-react/;
    const offenders = walk("src")
      .filter((path) => /\.tsx?$/.test(path))
      .filter((path) => importsIt.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);

    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect({
      ...(pkg.dependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    }).not.toHaveProperty("@stapel/attributes-react");
  });
});
