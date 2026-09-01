/**
 * The two OPTIONAL editor engines — CodeMirror 6 (`txt`, and markdown source)
 * and Milkdown (markdown WYSIWYG).
 *
 * What this suite has to prove, in the order the design promises it:
 *
 * 1. **Byte stability.** `serialize ∘ parse` is the identity on the strings
 *    that break normalizing editors. This is the acceptance criterion the
 *    editors research put above comfort (§1.1): stapel-docs is written to by
 *    services, and a document rewritten merely by being opened corrupts every
 *    artifact derived from it.
 * 2. **Lazy, for real.** The engine is fetched with `import()` at MOUNT, never
 *    at module load — and the real specifier resolves (the CodeMirror peers
 *    are installed here, so one test drives the DEFAULT loader rather than a
 *    stub: a suite that only ever injects its own loader proves the wiring and
 *    not the integration).
 * 3. **Absence is a designed arm.** With a peer missing the surface renders
 *    the pair's plain builtin under a sentence, and the document is still
 *    edited and SAVED through the same If-Match bag.
 * 4. **The registry contract.** Both engines register as ordinary
 *    `DocEditorComponent`s for the hints stapel-docs actually emits
 *    (`"text"`, `"markdown"` — not `"txt"`/`"md"`), and an explicit
 *    registration still wins in the skin's ladder.
 *
 * `@milkdown/crepe` is driven through the injected loader on purpose: it is
 * the arm a host reaches with the package present, and mounting a real
 * ProseMirror view in jsdom would test jsdom, not this seam.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { DocEditor } from "../src/headless/DocEditor.js";
import type { DocEditorBag } from "../src/headless/DocEditor.js";
import { registerDocsI18n } from "../src/i18n/keys.js";
import {
  explicitDocEditor,
  registerDocEditor,
  resolveDocEditor,
  unregisterDocEditor,
} from "../src/editors/registry.js";
import type { DocEditorComponent } from "../src/editors/registry.js";
import { isOptionalPeerMissing } from "../src/editors/optionalPeer.js";
import {
  CODEMIRROR_PEERS,
  createCodeMirrorDocEditor,
  loadCodeMirror,
} from "../src/editors/codemirror/index.js";
import {
  isByteStable,
  parseDocSource,
  serializeDocSource,
  registerCodeMirrorDocEditors,
} from "../src/editors/codemirror/index.js";
import type { CodeMirrorModules } from "../src/editors/codemirror/index.js";
import {
  MILKDOWN_PEER,
  createMilkdownDocEditor,
  registerMilkdownDocEditor,
} from "../src/editors/milkdown/index.js";
import type { MilkdownModule } from "../src/editors/milkdown/index.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrap(runtime: DocsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerDocsI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <DocsProvider runtime={runtime}>{children}</DocsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Mount an editor over a real content read, and keep the bag reachable. */
function mount(
  Editor: DocEditorComponent,
  documentId = "d-1"
): { bag: () => DocEditorBag } {
  const runtime = createDocsRuntime({ baseUrl: BASE });
  let latest: DocEditorBag | null = null;
  render(
    wrap(
      runtime,
      <DocEditor documentId={documentId}>
        {(bag) => {
          latest = bag;
          return <Editor bag={bag} />;
        }}
      </DocEditor>
    )
  );
  return {
    bag: () => {
      if (latest === null) throw new Error("bag not rendered yet");
      return latest;
    },
  };
}

/** A content route that answers `text` at `seq` and accepts the save. */
function contentWire(state: { text: string; seq: number }): void {
  server.use(
    http.get(`${BASE}/documents/d-1/content`, () =>
      HttpResponse.text(state.text, {
        headers: { "X-Docs-Head-Seq": String(state.seq) },
      })
    ),
    http.put(`${BASE}/documents/d-1/content`, async ({ request }) => {
      state.text = await request.text();
      state.seq += 1;
      return HttpResponse.json({ head_seq: state.seq, revision_id: "rev-2" });
    })
  );
}

// ── 1. byte stability ───────────────────────────────────────────────────────

describe("CodeMirror source codec — serialize ∘ parse is the IDENTITY", () => {
  /** Every string here is one a normalizing markdown serializer rewrites:
   * remark alone changes the first four and drops or adds the last two. */
  const TRICKY: readonly [string, string][] = [
    ["asterisk list markers", "* one\n* two\n"],
    ["ordered list numbering", "1. one\n1. two\n1. three\n"],
    ["escapes a serializer would re-spell", "a \\* b \\_c\\_ \\[d\\]\n"],
    ["setext heading", "Title\n=====\n\nBody\n"],
    ["underscore emphasis", "__bold__ and _italic_\n"],
    ["hard break as two spaces", "line one  \nline two\n"],
    ["no trailing newline", "no newline at eof"],
    ["CRLF line endings", "one\r\ntwo\r\n"],
    ["indented code block", "    const x = 1;\n"],
    ["trailing whitespace inside a fence", "```js\nconst x = 1;   \n```\n"],
    ["empty document", ""],
    ["only newlines", "\n\n\n"],
  ];

  it.each(TRICKY)("round-trips %s byte for byte", (_name, raw) => {
    expect(serializeDocSource(parseDocSource(raw))).toBe(raw);
    expect(isByteStable(raw)).toBe(true);
  });

  it("holds for a machine-written document as a whole", () => {
    // The shape a service writes: front matter, headings, a table, a fence.
    const generated = [
      "---",
      "source: meeting-42",
      "---",
      "",
      "## Summary",
      "",
      "* decided: ship the wave",
      "* owner: **u-2**",
      "",
      "| step | when |",
      "|------|------|",
      "| cut  | fri  |",
      "",
      "```sh",
      "pnpm ci   ",
      "```",
      "",
    ].join("\n");
    expect(serializeDocSource(parseDocSource(generated))).toBe(generated);
  });
});

// ── 2. lazy, for real ───────────────────────────────────────────────────────

describe("the engines are LAZY (nothing loads at import time)", () => {
  it("the CodeMirror loader is not called until a surface mounts", async () => {
    const loadPeer = vi.fn(async (): Promise<CodeMirrorModules> => loadCodeMirror());
    const Editor = createCodeMirrorDocEditor({ loadPeer });
    expect(loadPeer).not.toHaveBeenCalled();

    contentWire({ text: "hello", seq: 4 });
    mount(Editor);
    await waitFor(() => {
      expect(loadPeer).toHaveBeenCalledTimes(1);
    });
  });

  it("the REAL loader resolves the real @codemirror packages and mounts a view", async () => {
    // No stub: this is the test that would fail if the specifiers were wrong,
    // the packages were not optional peers, or the dynamic import were
    // accidentally made static.
    contentWire({ text: "# heading\n\ntext\n", seq: 4 });
    const Editor = createCodeMirrorDocEditor({ language: "markdown" });
    mount(Editor);
    const host = await screen.findByTestId("docs-editor-codemirror");
    await waitFor(() => {
      expect(host.querySelector(".cm-editor")).not.toBeNull();
    });
    expect(host.textContent).toContain("heading");
  });

  it("names the three CodeMirror specifiers it may fail to resolve", () => {
    expect(CODEMIRROR_PEERS.state).toBe("@codemirror/state");
    expect(CODEMIRROR_PEERS.view).toBe("@codemirror/view");
    expect(CODEMIRROR_PEERS.langMarkdown).toBe("@codemirror/lang-markdown");
    expect(MILKDOWN_PEER).toBe("@milkdown/crepe");
  });
});

// ── 3. absence is a designed arm ────────────────────────────────────────────

describe("a missing optional peer degrades to the builtin, not to a crash", () => {
  it("CodeMirror absent: the sentence renders AND the document still saves", async () => {
    const state = { text: "hello", seq: 4 };
    contentWire(state);
    const Editor = createCodeMirrorDocEditor({
      loadPeer: () => {
        // The shape a bundler throws when the package is not installed.
        return Promise.reject(
          new Error("Failed to resolve import \"@codemirror/view\" from src")
        );
      },
    });
    const { bag } = mount(Editor);

    await screen.findByTestId("docs-editor-engine-absent");
    const textarea = await screen.findByDisplayValue("hello");
    fireEvent.change(textarea, { target: { value: "hello world" } });
    await waitFor(() => {
      expect(bag().dirty).toBe(true);
    });
    act(() => {
      bag().save();
    });
    await waitFor(() => {
      expect(state.text).toBe("hello world");
    });
  });

  it("a module that resolves but carries no EditorView counts as missing", async () => {
    contentWire({ text: "hello", seq: 4 });
    const Editor = createCodeMirrorDocEditor({
      loadPeer: () => Promise.resolve({} as unknown as CodeMirrorModules),
    });
    mount(Editor);
    await screen.findByTestId("docs-editor-engine-absent");
  });

  it("a REAL error from inside the package is not laundered into 'not installed'", () => {
    expect(
      isOptionalPeerMissing(new Error("Cannot find module '@codemirror/view'"), [
        "@codemirror/view",
      ])
    ).toBe(true);
    expect(
      isOptionalPeerMissing(new Error("@codemirror/view: illegal state"), [
        "@codemirror/view",
      ])
    ).toBe(false);
    expect(isOptionalPeerMissing(new Error("boom"), ["@codemirror/view"])).toBe(false);
  });

  it("Milkdown absent: the markdown surface falls back to CodeMirror source", async () => {
    contentWire({ text: "# heading\n", seq: 4 });
    const Editor = createMilkdownDocEditor({
      loadPeer: () =>
        Promise.reject(new Error('Cannot find module "@milkdown/crepe"')),
    });
    mount(Editor);
    await screen.findByTestId("docs-editor-engine-absent");
    // The byte-stable surface is what a host gets instead — not nothing.
    await screen.findByTestId("docs-editor-codemirror");
  });
});

// ── 4. the registry contract ────────────────────────────────────────────────

describe("Milkdown honours the DocEditorComponent contract", () => {
  /** The sliver of Crepe the surface uses, as a fake: constructed with a root
   * and a default value, `create()`d, listened to, destroyed. */
  function fakeCrepe(): {
    module: MilkdownModule;
    emit: (markdown: string) => void;
    instances: number;
    destroyed: number;
  } {
    const listeners: ((markdown: string) => void)[] = [];
    const counts = { instances: 0, destroyed: 0 };
    class Crepe {
      constructor(private readonly config: { root: HTMLElement; defaultValue?: string }) {
        counts.instances += 1;
      }
      create(): Promise<unknown> {
        this.config.root.setAttribute("data-crepe-seeded", this.config.defaultValue ?? "");
        return Promise.resolve(this);
      }
      destroy(): unknown {
        counts.destroyed += 1;
        return undefined;
      }
      getMarkdown(): string {
        return this.config.defaultValue ?? "";
      }
      on(register: (listener: {
        markdownUpdated(cb: (ctx: unknown, markdown: string, previous: string) => void): unknown;
      }) => void): unknown {
        register({
          markdownUpdated(cb) {
            listeners.push((markdown) => {
              cb(null, markdown, "");
            });
            return undefined;
          },
        });
        return undefined;
      }
    }
    return {
      module: { Crepe } as unknown as MilkdownModule,
      emit: (markdown) => {
        for (const listener of listeners) listener(markdown);
      },
      get instances() {
        return counts.instances;
      },
      get destroyed() {
        return counts.destroyed;
      },
    };
  }

  it("seeds from the bag, reports edits back into it, and saves through If-Match", async () => {
    const state = { text: "# heading\n", seq: 4 };
    contentWire(state);
    const crepe = fakeCrepe();
    const Editor = createMilkdownDocEditor({
      loadPeer: () => Promise.resolve(crepe.module),
    });
    const { bag } = mount(Editor);

    const host = await screen.findByTestId("docs-editor-milkdown");
    // Seeded with the LOADED content, not with the empty pre-load value.
    await waitFor(() => {
      expect(host.getAttribute("data-crepe-seeded")).toBe("# heading\n");
    });

    act(() => {
      crepe.emit("# heading\n\nedited\n");
    });
    await waitFor(() => {
      expect(bag().dirty).toBe(true);
    });
    act(() => {
      bag().save();
    });
    await waitFor(() => {
      expect(state.text).toBe("# heading\n\nedited\n");
    });
  });

  it("an update equal to the current value does NOT dirty the document", async () => {
    // The open must not rewrite the file: remark normalizes, so an editor that
    // reported its own re-serialization as an edit would mark every
    // machine-written document dirty the instant it was viewed.
    contentWire({ text: "* one\n", seq: 4 });
    const crepe = fakeCrepe();
    const Editor = createMilkdownDocEditor({
      loadPeer: () => Promise.resolve(crepe.module),
    });
    const { bag } = mount(Editor);
    await screen.findByTestId("docs-editor-milkdown");
    await waitFor(() => {
      expect(bag().value).toBe("* one\n");
    });

    act(() => {
      crepe.emit("* one\n");
    });
    expect(bag().dirty).toBe(false);
  });

  it("the mode switch hands the document to the byte-stable source surface", async () => {
    contentWire({ text: "* one\n", seq: 4 });
    const crepe = fakeCrepe();
    const Editor = createMilkdownDocEditor({
      loadPeer: () => Promise.resolve(crepe.module),
    });
    mount(Editor);
    await screen.findByTestId("docs-editor-milkdown");

    fireEvent.click(screen.getByTestId("docs-editor-mode-switch"));
    await screen.findByTestId("docs-editor-codemirror");
    expect(screen.queryByTestId("docs-editor-milkdown")).toBeNull();
    // The rich engine was torn down, not left running behind the source view.
    await waitFor(() => {
      expect(crepe.destroyed).toBe(1);
    });
  });
});

describe("registration — the seam, not a fork", () => {
  afterEach(() => {
    unregisterDocEditor("text");
    unregisterDocEditor("markdown");
  });

  it("registerCodeMirrorDocEditors claims the hints stapel-docs emits", () => {
    const hints = registerCodeMirrorDocEditors({
      loadPeer: () => Promise.resolve({} as unknown as CodeMirrorModules),
    });
    expect([...hints]).toEqual(["text", "markdown"]);
    // Explicit registrations — which is what makes them outrank the skin's
    // own defaults in DocSurface's ladder.
    expect(explicitDocEditor("text")).not.toBeNull();
    expect(explicitDocEditor("markdown")).not.toBeNull();
    // CSV is deliberately untouched: the zero-dependency grid stays.
    expect(explicitDocEditor("csv")).toBeNull();
  });

  it("registerMilkdownDocEditor claims markdown and wins over the builtin", () => {
    const builtin = resolveDocEditor("markdown");
    const hint = registerMilkdownDocEditor({
      loadPeer: () => Promise.resolve({} as unknown as MilkdownModule),
    });
    expect(hint).toBe("markdown");
    expect(resolveDocEditor("markdown")).not.toBe(builtin);
    unregisterDocEditor("markdown");
    expect(resolveDocEditor("markdown")).toBe(builtin);
  });

  it("a host's own registration still wins over both engines", () => {
    function Custom(): ReactElement {
      return <div data-doc-editor="custom" />;
    }
    registerCodeMirrorDocEditors({
      loadPeer: () => Promise.resolve({} as unknown as CodeMirrorModules),
    });
    registerDocEditor("text", Custom);
    expect(resolveDocEditor("text")).toBe(Custom);
  });

  it("the engines render inside a wrap (the skin's chrome) when given one", async () => {
    contentWire({ text: "hello", seq: 4 });
    const Editor = createCodeMirrorDocEditor({
      loadPeer: () => Promise.resolve({} as unknown as CodeMirrorModules),
      wrap: ({ bag, children }) => (
        <div data-testid="wrap" data-dirty={String(bag.dirty)}>
          {children}
        </div>
      ),
    });
    mount(Editor);
    const chrome = await screen.findByTestId("wrap");
    expect(chrome.querySelector("[data-doc-editor-engine]")).not.toBeNull();
  });
});
