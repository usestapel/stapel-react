/**
 * A chip must print copy, not a storage slug — and the four sources of that
 * copy have a stated order.
 *
 *   1. the answer's `facet_labels` (stapel-search 0.4.0+);
 *   2. the category feature def's inline `options` table;
 *   3. the host's `resolveFacetLabels`;
 *   4. the raw value.
 *
 * The deployment this was measured against sits below step 1 — its `/query`
 * answers carry no `facet_labels` key at all — and its `vendor`, `model`,
 * `memory_size` and `color_ref_select` features sit below step 2, because a
 * `ref_select` config carries a POINTER to a vocabulary and no options. So
 * without step 3 its chips read `apple`, `128-gb`, `chernyy`.
 *
 * Every test drives the real hook through the real `<SearchPage>` with the
 * wire mocked and nothing else: a stubbed `buildFacetGroups` would only have
 * proved the precedence of a stub.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import type { FeatureDef } from "@stapel/attributes-react";
import { SearchPage } from "../src/default/index.js";
import type {
  FacetLabelRequest,
  FacetLabelResolver,
  SearchParamsAdapter,
} from "../src/index.js";
import { PHONE_FEATURES, legacySearchResponse, searchResponse } from "./fixtures.js";
import { TestProviders, mockServer, useTestParams } from "./harness.js";

afterEach(cleanup);

/**
 * What the host's vocabulary client answers for the phone catalogue.
 *
 * `xiaomi` is deliberately absent: a code the vocabulary no longer holds is
 * the normal case, not an error.
 */
const VOCABULARY: Readonly<Record<string, string>> = {
  apple: "Apple",
  samsung: "Samsung",
};

function hostResolver(seen: FacetLabelRequest[]): FacetLabelResolver {
  return async (request) => {
    seen.push(request);
    const out: Record<string, string> = {};
    for (const value of request.values) {
      const caption = VOCABULARY[value];
      if (caption !== undefined) out[value] = caption;
    }
    return await Promise.resolve(out);
  };
}

interface MountProps {
  readonly body?: unknown;
  readonly features?: readonly FeatureDef[];
  readonly seen?: FacetLabelRequest[];
  readonly resolve?: FacetLabelResolver | false;
  /** `"column"` puts the panel on the page; `"sheet"` draws the chip row. */
  readonly layout?: "column" | "sheet";
}

function mount(props: MountProps = {}): void {
  const resolve =
    props.resolve === undefined ? hostResolver(props.seen ?? []) : props.resolve;
  function Page(): ReactElement {
    const adapter: SearchParamsAdapter = useTestParams(
      "type=listing&category=elektronika/mobilnye-telefony"
    );
    return (
      <SearchPage
        adapter={adapter}
        defaultType="listing"
        filtersLayout={props.layout ?? "column"}
        categoryFeatures={props.features ?? PHONE_FEATURES}
        {...(resolve === false ? {} : { resolveFacetLabels: resolve })}
      />
    );
  }
  render(
    <TestProviders
      server={mockServer({
        "/query": { body: props.body ?? legacySearchResponse() },
        "/suggest": { body: { items: [], backend: "postgres" } },
      })}
    >
      <Page />
    </TestProviders>
  );
}

/**
 * Open the vendor axis.
 *
 * On the desktop rail a vocabulary-backed axis is a FIELD reading «Any»
 * (`dictionaryMode: "field"`, the layout's default since 0.26): its values —
 * and therefore every caption these tests are about — live behind it. The
 * host resolver still runs on the group's options either way; what changed is
 * only which click puts them on screen.
 */
async function openVendor(): Promise<void> {
  const field = await screen.findByTestId("facet-dictionary-field-vendor");
  fireEvent.click(field);
}

describe("the host resolver names what nothing else can", () => {
  it("turns a ref_select's storage slug into the vocabulary's word", async () => {
    mount();
    await openVendor();
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-vendor").textContent
      ).toContain("Apple");
    });
  });

  it("leaves a value the resolver cannot name printing its raw self", async () => {
    // A chip that silently dropped an option would be worse than one showing
    // a slug: the option is real, it has a count, and it is the only route to
    // those documents.
    mount();
    await openVendor();
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-vendor").textContent
      ).toContain("xiaomi");
    });
  });

  it("is asked ONCE per group, batched, with only the unresolved values", async () => {
    const seen: FacetLabelRequest[] = [];
    mount({ seen });
    await openVendor();
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-vendor").textContent
      ).toContain("Apple");
    });
    // `condition` carries its own inline option table, so it is never asked
    // about; `imei` and `video_file_url` are not facets at all any more.
    expect(seen.map((request) => request.slug)).toEqual(["vendor"]);
    expect(seen[0]?.values).toEqual(["apple", "samsung", "xiaomi"]);
  });

  it("hands the resolver the feature def, so a host can read the optionsRef", async () => {
    // Otherwise a host would have to keep a second copy of the schema just to
    // learn which vocabulary these codes belong to.
    const seen: FacetLabelRequest[] = [];
    mount({ seen });
    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    expect(seen[0]?.feature?.config["optionsRef"]).toEqual({
      level: "Vendor",
      vocabulary: "phone-catalog",
    });
  });

  it("hands the resolver an abort signal it can honour", async () => {
    const signals: AbortSignal[] = [];
    mount({
      resolve: async (_request, options) => {
        signals.push(options.signal);
        return await Promise.resolve({});
      },
    });
    await waitFor(() => {
      expect(signals.length).toBeGreaterThan(0);
    });
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0]?.aborted).toBe(false);
  });
});

describe("precedence: nobody overwrites a caption somebody better already gave", () => {
  it("the SERVER's facet_labels win over the host resolver", async () => {
    // The server saw the write-time snapshot. A host that would have said
    // something else is not asked at all.
    const seen: FacetLabelRequest[] = [];
    mount({
      seen,
      body: searchResponse({
        facets: { condition: { novoe: 12, "b-u": 31 } },
        facet_labels: {
          condition: {
            translatable: false,
            values: { novoe: "СЕРВЕР", "b-u": "СЕРВЕР Б/У" },
          },
        },
      }),
      // A `select` with NO option table: the schema cannot name these, so the
      // only two candidates left are the server and the host.
      features: [{ slug: "condition", name: "c", config: { type: "select" } }],
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-condition").textContent
      ).toContain("СЕРВЕР");
    });
    expect(seen.map((request) => request.slug)).not.toContain("condition");
  });

  it("the SERVER's caption beats a schema that COULD have named the value", async () => {
    // The sharp case: both sources can name `novoe`, and they disagree. The
    // answer wins — it read the write-time snapshot in the request's own
    // language, while the schema is a table the host happened to fetch. This
    // is the assertion that would silently invert if the order were ever
    // flipped back, because the two agree in every other fixture.
    mount({
      body: searchResponse({
        facets: { condition: { novoe: 12, "b-u": 31 } },
        facet_labels: {
          condition: {
            translatable: false,
            values: { novoe: "СЕРВЕР", "b-u": "СЕРВЕР Б/У" },
          },
        },
      }),
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-condition").textContent
      ).toContain("СЕРВЕР");
    });
    // `PHONE_FEATURES` captions the very same value through its inline options
    // table, with a different word, and does not get to.
    expect(
      screen.getByTestId("facet-group-condition").textContent
    ).not.toContain("Новое");
  });

  it("falls back to the schema on a server that sends no facet_labels at all", async () => {
    // The key is ABSENT on a pre-0.4.0 answer, not empty. Nothing throws, and
    // the page reads exactly as it did before the answer learned to caption.
    mount();
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-condition").textContent
      ).toContain("Новое");
    });
  });

  it("the SCHEMA's inline options table wins over the host resolver", async () => {
    const seen: FacetLabelRequest[] = [];
    mount({ seen });
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-condition").textContent
      ).toContain("Новое");
    });
    expect(seen.map((request) => request.slug)).not.toContain("condition");
  });

  it("ignores a caption the resolver volunteers for a value nobody asked about", async () => {
    // The guard is enforced on the way back in as well as on the way out.
    mount({
      resolve: async () =>
        await Promise.resolve({ novoe: "OVERWRITTEN", apple: "Apple" }),
    });
    await openVendor();
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-vendor").textContent
      ).toContain("Apple");
    });
    const condition = screen.getByTestId("facet-group-condition").textContent;
    expect(condition).toContain("Новое");
    expect(condition).not.toContain("OVERWRITTEN");
  });

  it("a page with no resolver keeps the raw value and asks nobody", async () => {
    const seen: FacetLabelRequest[] = [];
    mount({ resolve: false, seen });
    await openVendor();
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-vendor").textContent
      ).toContain("apple");
    });
    expect(seen).toEqual([]);
  });
});

describe("both filter surfaces agree", () => {
  it("the chip's own sheet prints the same host-resolved word as the panel", async () => {
    // One `useFacetPanel` and one cache behind both, so a value cannot read
    // one way on the phone row and another way in the desktop panel.
    const seen: FacetLabelRequest[] = [];
    mount({ layout: "sheet", seen });
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-vendor")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("search-chip-vendor"));
    await waitFor(() => {
      expect(
        screen.getByTestId("facet-group-vendor").textContent
      ).toContain("Apple");
    });
    // The row, the sheet and the page's layout probe all read one bag, so the
    // host is asked once however many surfaces are mounted.
    expect(seen.filter((request) => request.slug === "vendor")).toHaveLength(1);
  });
});
