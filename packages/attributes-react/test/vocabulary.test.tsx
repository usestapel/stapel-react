/**
 * The vocabulary seam and the two editors over it.
 *
 * The claims worth a test here are the ones a screenshot cannot make: that a
 * missing provider is LOUD and blocks the submit through the same channel a
 * missing editor does, that the search is debounced and SUPERSEDES rather than
 * races, that a parent's code narrows the child's level, and that changing the
 * parent clears an answer that no longer belongs to it.
 *
 * The client is stubbed at the SEAM, not at `fetch`, because the seam is the
 * contract: `@stapel/vocabularies-react` satisfies `VocabularyClient`
 * structurally and never imports it, so what a host actually hands in is two
 * functions — which is exactly what these tests hand in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { FeatureDef, Rule } from "../src/types.js";
import {
  VocabularyClientProvider,
  optionsRefOf,
  firstCode,
  unsupportedTypeGate,
  unsupportedTypes,
} from "../src/index.js";
import type { VocabularyClient, VocabularyTerm } from "../src/index.js";
import { PICKER_SEARCH_TESTID } from "@stapel/tokens-antd/skin";
import { ATTRIBUTES_I18N_KEYS, registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields } from "../src/default/FeatureFields.js";
import { BUILTIN_VALUE_EDITOR_TYPES } from "../src/default/editors.js";
import {
  REF_HIERARCHICAL_FEATURE,
  REF_SELECT_CHILD_FEATURE,
  REF_SELECT_FEATURE,
  STRING_FEATURE,
} from "./fixtures.js";

afterEach(() => cleanup());

const VENDORS: readonly VocabularyTerm[] = [
  { code: "apple", label: "Apple", has_children: true },
  { code: "samsung", label: "Samsung", has_children: true },
];
const MODELS: Readonly<Record<string, readonly VocabularyTerm[]>> = {
  apple: [{ code: "iphone-15", label: "iPhone 15" }],
  samsung: [{ code: "galaxy-s24", label: "Galaxy S24" }],
};

function stubClient(overrides: Partial<VocabularyClient> = {}): {
  client: VocabularyClient;
  search: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn(
    async (
      _vocabulary: string,
      level: string,
      query: string,
      parent?: string
    ): Promise<readonly VocabularyTerm[]> => {
      const rows =
        level === "Vendor" || level === "Make"
          ? VENDORS
          : (MODELS[parent ?? ""] ?? []);
      return rows.filter((row) => row.label.toLowerCase().includes(query.toLowerCase()));
    }
  );
  return {
    search,
    client: {
      search,
      resolve: async () => ({}),
      ...overrides,
    },
  };
}

function wrap(node: ReactElement, client: VocabularyClient | null): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return (
    <I18nProvider i18n={i18n}>
      <VocabularyClientProvider value={client}>{node}</VocabularyClientProvider>
    </I18nProvider>
  );
}

/** The field a closed sheet leaves behind — tapping it is what opens the
 * sheet and asks the level for its first page. */
function triggers(): readonly HTMLElement[] {
  return screen.getAllByTestId("attributes-ref-trigger");
}

/** Type into the open sheet's search box. */
function typeQuery(query: string): void {
  fireEvent.change(screen.getByTestId(PICKER_SEARCH_TESTID), { target: { value: query } });
}

/** A row of the open sheet, by its label. */
function sheetRow(label: string): HTMLButtonElement | undefined {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-stapel-picker-row]")
  ).find((node) => (node.textContent ?? "").includes(label));
}

describe("no provider is a loud state, through the existing channel", () => {
  it("draws the notice with the vocabulary sentence, not the generic one", () => {
    render(
      wrap(
        <FeatureFields features={[REF_SELECT_FEATURE]} values={{}} onChange={() => {}} />,
        null
      )
    );
    const notice = screen.getByTestId("attributes-unsupported-type");
    expect(notice.getAttribute("data-attributes-reason")).toBe(
      ATTRIBUTES_I18N_KEYS.vocabularyUnavailable
    );
    expect(notice.getAttribute("data-attributes-type")).toBe("ref_select");
  });

  it("blocks the submit through unsupportedTypes / unsupportedTypeGate", () => {
    const features = [STRING_FEATURE, REF_SELECT_FEATURE];
    // Without the fact, nothing is claimed: a caller that never looked for a
    // client must not have its submit blocked for a category with no ref
    // feature in it.
    expect(unsupportedTypes(features, BUILTIN_VALUE_EDITOR_TYPES)).toEqual([]);
    expect(
      unsupportedTypes(features, BUILTIN_VALUE_EDITOR_TYPES, { vocabularyClient: null })
    ).toEqual(["ref_select"]);
    const gate = unsupportedTypeGate(features, BUILTIN_VALUE_EDITOR_TYPES, {
      vocabularyClient: null,
    });
    expect(gate.available).toBe(false);
    // The FEATURE's name, never the type slug — the reason is read by the
    // person whose submit is blocked.
    expect(gate.block?.params["features"]).toBe("vendor");
  });

  it("a client in scope makes the same features drawable again", () => {
    const { client } = stubClient();
    expect(
      unsupportedTypes([REF_SELECT_FEATURE], BUILTIN_VALUE_EDITOR_TYPES, {
        vocabularyClient: client,
      })
    ).toEqual([]);
  });
});

describe("a feature whose rules do not parse goes down the same channel", () => {
  // A violation has to be CAST in: the generated `Rule` type describes a valid
  // rule, and the only way one reaches a running form is off the wire, where
  // nothing type-checks it.
  const broken: FeatureDef = {
    ...STRING_FEATURE,
    rules: [{ effect: "nope" }] as unknown as readonly Rule[],
  };

  it("is drawn as the notice instead of as an unconditional field", () => {
    render(wrap(<FeatureFields features={[broken]} values={{}} onChange={() => {}} />, null));
    expect(
      screen.getByTestId("attributes-unsupported-type").getAttribute("data-attributes-reason")
    ).toBe(ATTRIBUTES_I18N_KEYS.invalidRules);
  });

  it("blocks the submit, because neither its visibility nor its requiredness is known", () => {
    expect(unsupportedTypes([broken], BUILTIN_VALUE_EDITOR_TYPES)).toEqual(["(invalid rules)"]);
  });
});

describe("RefSelectEditor", () => {
  it("fetches the level's first page when the SHEET opens, not before", async () => {
    const { client, search } = stubClient();
    render(
      wrap(
        <FeatureFields features={[REF_SELECT_FEATURE]} values={{}} onChange={() => {}} />,
        client
      )
    );
    expect(search).not.toHaveBeenCalled();
    fireEvent.click(triggers()[0] as HTMLElement);
    await waitFor(() => expect(search).toHaveBeenCalledWith("phone-models", "Vendor", "", undefined, expect.anything()));
    await waitFor(() => expect(sheetRow("Apple")).toBeDefined());
  });

  it("debounces typing and supersedes the in-flight search", async () => {
    vi.useFakeTimers();
    try {
      const { client, search } = stubClient();
      render(
        wrap(
          <FeatureFields features={[REF_SELECT_FEATURE]} values={{}} onChange={() => {}} />,
          client
        )
      );
      fireEvent.click(triggers()[0] as HTMLElement);
      await act(async () => {
        await Promise.resolve();
      });
      typeQuery("a");
      typeQuery("ap");
      typeQuery("app");
      const typed = (): unknown[] =>
        search.mock.calls.filter((call) => call[2] !== "").map((call) => call[2]);
      expect(typed()).toEqual([]);
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      // Three keystrokes inside the window are ONE request, and it is the
      // LAST query — not the first, which is the version that leaves a list
      // showing results for "a". Two requests in total: the level's first
      // page, asked for ONCE when the sheet opened, and this one.
      expect(typed()).toEqual(["app"]);
      expect(search.mock.calls.map((call) => call[2])).toEqual(["", "app"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the previous request when a newer one starts", async () => {
    vi.useFakeTimers();
    try {
      const { client, search } = stubClient();
      render(
        wrap(
          <FeatureFields features={[REF_SELECT_FEATURE]} values={{}} onChange={() => {}} />,
          client
        )
      );
      fireEvent.click(triggers()[0] as HTMLElement);
      await act(async () => {
        await Promise.resolve();
      });
      typeQuery("a");
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      typeQuery("sam");
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      const signalFor = (query: string): AbortSignal =>
        search.mock.calls.find((call) => call[2] === query)?.[4] as AbortSignal;
      expect(signalFor("a").aborted).toBe(true);
      expect(signalFor("sam").aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("narrows the child level by the parent's code", async () => {
    const { client, search } = stubClient();
    render(
      wrap(
        <FeatureFields
          features={[REF_SELECT_FEATURE, REF_SELECT_CHILD_FEATURE]}
          values={{ vendor: ["apple"] }}
          onChange={() => {}}
        />,
        client
      )
    );
    fireEvent.click(triggers()[1] as HTMLElement);
    await waitFor(() =>
      expect(search).toHaveBeenCalledWith(
        "phone-models",
        "Model",
        "",
        "apple",
        expect.anything()
      )
    );
    await waitFor(() => expect(sheetRow("iPhone 15")).toBeDefined());
  });

  it("clears its own answer when the parent moves, and not on the first render", async () => {
    const { client } = stubClient();
    const onChange = vi.fn();
    const features = [REF_SELECT_FEATURE, REF_SELECT_CHILD_FEATURE];
    const { rerender } = render(
      wrap(
        <FeatureFields
          features={features}
          values={{ vendor: ["apple"], model: ["iphone-15"] }}
          onChange={onChange}
        />,
        client
      )
    );
    // Seeding a saved draft is not a change: the answer it was seeded with
    // must survive the first render.
    expect(onChange).not.toHaveBeenCalled();
    rerender(
      wrap(
        <FeatureFields
          features={features}
          values={{ vendor: ["samsung"], model: ["iphone-15"] }}
          onChange={onChange}
        />,
        client
      )
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("model", undefined));
  });

  it("keeps a stored code pickable even before the level is searched", () => {
    const { client } = stubClient();
    render(
      wrap(
        <FeatureFields
          features={[REF_SELECT_FEATURE]}
          values={{ vendor: ["apple"] }}
          onChange={() => {}}
        />,
        client
      )
    );
    // Reopening a draft must not empty the control while the vocabulary is
    // unread — the code stands in for the label until `resolve` replaces it.
    expect((triggers()[0] as HTMLElement).textContent).toContain("apple");
  });
});

describe("RefHierarchicalSelectEditor", () => {
  it("asks for nothing until a rung is opened, then asks that rung's level once", async () => {
    const { client, search } = stubClient();
    render(
      wrap(
        <FeatureFields features={[REF_HIERARCHICAL_FEATURE]} values={{}} onChange={() => {}} />,
        client
      )
    );
    // The chain is three rungs and 107 049 modifications; the old Cascader
    // fetched its root column on mount, for every such field on the form,
    // whether or not anybody was going to answer it.
    expect(search).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("attributes-ref-rung-trigger-0"));
    await waitFor(() =>
      expect(search).toHaveBeenCalledWith("car-models", "Make", "", undefined, expect.anything())
    );
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("gates every rung below the one being answered, with the reason as TEXT", () => {
    const { client } = stubClient();
    render(
      wrap(
        <FeatureFields features={[REF_HIERARCHICAL_FEATURE]} values={{}} onChange={() => {}} />,
        client
      )
    );
    // The root rung is answerable; the two under it are waiting, and each says
    // which answer it is waiting for — beside the control, never in a tooltip
    // a disabled control could not show anyway.
    expect(screen.queryByTestId("attributes-ref-rung-gate-0")).toBeNull();
    expect(screen.getByTestId("attributes-ref-rung-gate-1")).toBeDefined();
    expect(
      (screen.getByTestId("attributes-ref-rung-trigger-1") as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByText("Choose Make first.")).toBeDefined();
  });
});

describe("the seam's own helpers", () => {
  it("reads an optionsRef, and refuses a malformed one", () => {
    expect(optionsRefOf({ optionsRef: { vocabulary: "v", level: "l" } })).toEqual({
      vocabulary: "v",
      level: "l",
    });
    expect(optionsRefOf({ optionsRef: { vocabulary: "v" } })).toBeUndefined();
    expect(optionsRefOf({})).toBeUndefined();
  });

  it("takes the FIRST code of a sibling's answer — a parent narrows by one term", () => {
    expect(firstCode(["apple", "samsung"])).toBe("apple");
    expect(firstCode("apple")).toBe("apple");
    expect(firstCode([])).toBeUndefined();
    expect(firstCode(undefined)).toBeUndefined();
  });
});
