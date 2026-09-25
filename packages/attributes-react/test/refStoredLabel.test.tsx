/**
 * A stored code is shown by its LABEL, however the codes move under the ask.
 *
 * Measured on the car composer: the make held `vaz-lada` and drew the slug
 * instead of its label. The resolve was sent, the codes the editor wanted
 * labels for changed before it answered, and the answer was dropped — while
 * the code stayed marked as asked, so it was never asked again.
 */
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { VocabularyClientProvider } from "../src/index.js";
import type { VocabularyClient } from "../src/index.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields } from "../src/default/FeatureFields.js";
import { REF_SELECT_FEATURE } from "./fixtures.js";

afterEach(() => cleanup());

function slowClient(): VocabularyClient {
  return {
    search: async () => [],
    resolve: (_vocabulary, _level, codes) =>
      new Promise((done) => {
        setTimeout(() => {
          done(Object.fromEntries(codes.map((code) => [code, code === "vaz-lada" ? "ВАЗ (LADA)" : code])));
        }, 30);
      }),
  };
}

function mount(values: Record<string, unknown>, client: VocabularyClient): ReturnType<typeof render> {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <VocabularyClientProvider value={client}>
          <FeatureFields features={[REF_SELECT_FEATURE]} values={values} onChange={() => {}} />
        </VocabularyClientProvider>
      </I18nProvider>
    </StrictMode>
  );
}

describe("a ref_select's stored code", () => {
  it("is drawn by its label after a remount under the ask", async () => {
    mount({ vendor: ["vaz-lada"] }, slowClient());
    await waitFor(() => {
      expect(screen.getByTestId("attributes-ref-trigger").textContent).toContain("ВАЗ (LADA)");
    });
  });

  it("is drawn by its label when the codes move while the first ask is in flight", async () => {
    const client = slowClient();
    const view = mount({ vendor: ["vaz-lada"] }, client);
    const i18n = createI18n({ locale: "en" });
    registerAttributesI18n(i18n);
    view.rerender(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <VocabularyClientProvider value={client}>
            <FeatureFields features={[REF_SELECT_FEATURE]} values={{ vendor: ["vaz-lada", "toyota"] }} onChange={() => {}} />
          </VocabularyClientProvider>
        </I18nProvider>
      </StrictMode>
    );
    await waitFor(() => {
      expect(screen.getByTestId("attributes-ref-trigger").textContent).toContain("ВАЗ (LADA)");
    });
  });
});
