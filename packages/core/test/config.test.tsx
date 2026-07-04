import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createStapelClient } from "../src/client.js";
import { StapelConfigProvider, useStapelClient } from "../src/config.js";
import type { StapelConfig } from "../src/config.js";

const defaultClient = createStapelClient({ baseUrl: "https://api.default" });
const authClient = createStapelClient({ baseUrl: "https://api.auth-fork" });

function wrapperFor(config: StapelConfig) {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return (
      <StapelConfigProvider config={config}>
        {props.children}
      </StapelConfigProvider>
    );
  };
}

describe("useStapelClient", () => {
  it("returns the default client", () => {
    const { result } = renderHook(() => useStapelClient(), {
      wrapper: wrapperFor({ client: defaultClient }),
    });
    expect(result.current).toBe(defaultClient);
  });

  it("returns the per-module override when configured (frontend-standard §7.2)", () => {
    const wrapper = wrapperFor({
      client: defaultClient,
      clients: { auth: authClient },
    });
    const auth = renderHook(() => useStapelClient("auth"), { wrapper });
    expect(auth.result.current).toBe(authClient);

    const billing = renderHook(() => useStapelClient("billing"), { wrapper });
    expect(billing.result.current).toBe(defaultClient);
  });

  it("throws without a provider", () => {
    expect(() => renderHook(() => useStapelClient())).toThrowError(
      /within a <StapelConfigProvider>/
    );
  });
});
