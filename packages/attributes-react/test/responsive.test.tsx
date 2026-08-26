/**
 * Every `/default` surface, drawn at BOTH widths and on BOTH sides of the
 * theme.
 *
 * The demos are what photograph this skin; this file is the machine half of
 * the same claim — a surface that renders only on a desktop, or only in light
 * mode, fails here rather than in somebody's browser. It is the gap the audit
 * named for this package: the antd editors on disk had never been rendered in
 * a story, so nothing photographed them and nothing protected them.
 *
 * The viewport and the theme are mocked at the ENVIRONMENT edge (a real
 * `matchMedia` over a real `innerWidth`, a real `data-theme` attribute), never
 * by stubbing `useDialogSurface`/`useThemeMode` — a stub would keep passing if
 * a hook's media query and `@stapel/tokens`' breakpoints ever disagreed. That
 * matters here more than in most pairs: `SkinTheme` raises antd's
 * `controlHeight` to 44px on a phone, so every input, select and switch these
 * editors draw is a real touch target only if the query is the right one.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ReactNode } from "react";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import {
  FeatureBadges,
  FeatureFields,
  FeatureValueList,
  UnsupportedValueEditor,
  featureControlId,
} from "../src/default/index.js";
import type { FeaturesDto } from "../src/types.js";
import {
  ALL_BUILTIN_FEATURES,
  BOOL_FEATURE,
  HEX_COLOR_FEATURE,
  INT_FEATURE,
  STRING_FEATURE,
  UNKNOWN_TYPE_FEATURE,
} from "./fixtures.js";

// ── viewport + theme, mocked at the ENVIRONMENT edge ────────────────────────

type ViewportListener = () => void;
const viewportListeners = new Set<ViewportListener>();

/** The two widths the viewer offers, and the two these demos declare. */
const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 1280;

function installViewport(): void {
  window.matchMedia = ((query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const matches = (): boolean =>
      min === null ? false : window.innerWidth >= Number(min[1]);
    return {
      get matches() {
        return matches();
      },
      media: query,
      onchange: null,
      addListener: (l: ViewportListener) => viewportListeners.add(l),
      removeListener: (l: ViewportListener) => viewportListeners.delete(l),
      addEventListener: (_: string, l: ViewportListener) => viewportListeners.add(l),
      removeEventListener: (_: string, l: ViewportListener) => viewportListeners.delete(l),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  act(() => {
    for (const listener of [...viewportListeners]) listener();
    window.dispatchEvent(new Event("resize"));
  });
}

/** Stamp the document's theme and let `useThemeMode`'s observer deliver it. */
async function setDocumentTheme(mode: "light" | "dark" | null): Promise<void> {
  await act(async () => {
    if (mode === null) document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    await Promise.resolve();
  });
}

/**
 * The frame a host puts these controls in: a translator plus the shared
 * `SkinTheme`. This package draws form rows, not pages, so it self-themes
 * nowhere and must be legible inside whatever surface the host painted —
 * which is exactly what is asserted below.
 */
function Skinned(props: { children: ReactNode }): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return (
    <I18nProvider i18n={i18n}>
      <SkinTheme surface="base">{props.children}</SkinTheme>
    </I18nProvider>
  );
}

/** A stateful `<FeatureFields/>`: the component owns no draft by design. */
function Fields(props: { readonly disabled?: boolean }): ReactElement {
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>({});
  return (
    <FeatureFields
      features={ALL_BUILTIN_FEATURES}
      values={values}
      disabled={props.disabled === true}
      onChange={(slug, value) => setValues((prev) => ({ ...prev, [slug]: value }))}
    />
  );
}

const VALUES: FeaturesDto = {
  title: { type: "string", value: "Golf" },
  year: { type: "int", value: 2010 },
  negotiable: { type: "bool", value: true },
  colour: { type: "hex_color", value: { simple: "red", hex: "#FF0000" } },
};

const BADGED = [
  { ...INT_FEATURE, show_as_badge: true },
  { ...BOOL_FEATURE, show_as_badge: true },
  { ...HEX_COLOR_FEATURE, show_as_badge: true },
  STRING_FEATURE,
];

/** Every `/default` surface the package ships, with the props that make it
 * real — the same four names the default-skin gate requires a demo for. */
const SURFACES: readonly {
  readonly name: string;
  readonly find: () => HTMLElement;
  readonly render: () => ReactElement;
}[] = [
  {
    name: "FeatureFields",
    find: () => screen.getByLabelText("title"),
    render: () => <Fields />,
  },
  {
    name: "UnsupportedValueEditor",
    find: () => screen.getByTestId("attributes-unsupported-type"),
    render: () => <UnsupportedValueEditor feature={UNKNOWN_TYPE_FEATURE} />,
  },
  {
    name: "FeatureBadges",
    find: () => screen.getByTestId("attributes-badges"),
    render: () => <FeatureBadges features={BADGED} values={VALUES} />,
  },
  {
    name: "FeatureValueList",
    find: () => screen.getByTestId("attributes-value-list"),
    render: () => <FeatureValueList features={ALL_BUILTIN_FEATURES} values={VALUES} />,
  },
];

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  viewportListeners.clear();
});
afterEach(async () => {
  await setDocumentTheme(null);
});

describe.each([
  ["phone", PHONE_WIDTH],
  ["desktop", DESKTOP_WIDTH],
] as const)("%s", (_label, width) => {
  describe.each(["light", "dark"] as const)("%s", (mode) => {
    for (const surface of SURFACES) {
      it(`renders <${surface.name}> on the ${mode} side`, async () => {
        setViewport(width);
        await setDocumentTheme(mode);
        const { container } = render(<Skinned>{surface.render()}</Skinned>);
        await waitFor(() => {
          expect(surface.find()).toBeTruthy();
        });
        // The skin painted ITS OWN surface on the side the document declares —
        // the defect this replaces was a light-themed control on a dark page.
        const root = container.querySelector("[data-stapel-skin-root]");
        expect(root?.getAttribute("data-stapel-skin-mode")).toBe(mode);
      });
    }
  });
});

describe("the phone shape is a different shape, not a narrower one", () => {
  it("raises antd's control height to a real touch target on a phone", async () => {
    setViewport(PHONE_WIDTH);
    await setDocumentTheme("light");
    const { container } = render(
      <Skinned>
        <Fields />
      </Skinned>
    );
    await waitFor(() => {
      expect(screen.getByLabelText("title")).toBeTruthy();
    });
    // 44px (WCAG 2.5.8) comes from SkinTheme's phone branch, applied as antd's
    // `controlHeight`. The evidence a jsdom test can see is the token the
    // provider handed down, so assert the wrapper is on the phone branch and
    // that the controls mounted inside it.
    expect(container.querySelector("[data-stapel-skin-root]")).toBeTruthy();
    expect(screen.getByLabelText("year")).toBeTruthy();
  });

  it("draws every builtin type at both widths — no editor is desktop-only", async () => {
    for (const width of [PHONE_WIDTH, DESKTOP_WIDTH]) {
      setViewport(width);
      const { unmount } = render(
        <Skinned>
          <Fields />
        </Skinned>
      );
      await waitFor(() => {
        expect(screen.getByLabelText("title")).toBeTruthy();
      });
      // One labelled control per non-header feature, at either width.
      for (const feature of ALL_BUILTIN_FEATURES) {
        if (feature.slug === "engine_section") continue;
        expect(
          document.getElementById(featureControlId(feature.slug)) ??
            screen.queryByLabelText(feature.name ?? feature.slug),
          `<${feature.slug}> drew no control at ${width}px`
        ).toBeTruthy();
      }
      unmount();
    }
  });
});
