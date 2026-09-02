/**
 * The host's component registry reaches THIS pair with zero pair wiring
 * (`SkinProvider` — tokens-antd's second restyle layer, see
 * `docs/skin-component-registry.md` in the repo root).
 *
 * The claim: a host registers a replacement Input ONCE, above everything,
 * and the attribute editors' text fields come out with the host's anatomy —
 * still labelled, still controlled, still emitting the engine's DTO shape.
 * Nothing in attributes-react names the override; consuming the substrate is
 * the wiring.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { SkinProvider } from "@stapel/tokens-antd/skin";
import type { SkinInputProps } from "@stapel/tokens-antd/skin";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields } from "../src/default/FeatureFields.js";
import { STRING_FEATURE } from "./fixtures.js";

afterEach(() => cleanup());

function HostInput(props: SkinInputProps): ReactElement {
  const { value, onChange, disabled, placeholder } = props;
  return (
    <span data-host-input="">
      <input
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        onChange={onChange}
        disabled={disabled === true}
        placeholder={placeholder}
        {...(props.id !== undefined ? { id: props.id } : {})}
        {...(props["aria-label"] !== undefined ? { "aria-label": props["aria-label"] } : {})}
        {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      />
    </span>
  );
}

function renderFields(withProvider: boolean): ReturnType<typeof vi.fn> {
  const onChange = vi.fn();
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const fields = (
    <I18nProvider i18n={i18n}>
      <FeatureFields features={[STRING_FEATURE]} values={{}} onChange={(slug, next) => onChange(slug, next)} />
    </I18nProvider>
  );
  render(withProvider ? <SkinProvider components={{ Input: HostInput }}>{fields}</SkinProvider> : fields);
  return onChange;
}

describe("the skin component registry", () => {
  it("an Input registered once at the host reskins the string editor — still labelled, still emitting", () => {
    const onChange = renderFields(true);
    const input = screen.getByLabelText("title");
    expect(input.closest("[data-host-input]")).not.toBeNull();
    fireEvent.change(input, { target: { value: "Golf" } });
    expect(onChange).toHaveBeenCalledWith("title", "Golf");
  });

  it("without a provider the editor stays the antd default", () => {
    renderFields(false);
    const input = screen.getByLabelText("title");
    expect(input.closest("[data-host-input]")).toBeNull();
    expect(input.className).toContain("ant-input");
  });
});
