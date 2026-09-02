/**
 * The host's component registry reaches THIS pair with zero pair wiring
 * (`SkinProvider` — tokens-antd's second restyle layer, see
 * `docs/skin-component-registry.md` in the repo root).
 *
 * The claim: a host registers a replacement Button ONCE, above everything,
 * and the drive screen's own controls — the upload FAB this package draws —
 * come out with the host's anatomy. Nothing in drive-react names the
 * override; consuming the substrate is the wiring.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { SkinProvider } from "@stapel/tokens-antd/skin";
import type { SkinButtonProps } from "@stapel/tokens-antd/skin";
import { DriveScreen } from "../src/default/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import { DOC_A, FOLDER_A } from "./fixtures.js";

const FULL = {
  "/folders": { body: [FOLDER_A] },
  "/documents": { body: [DOC_A] },
  "/starred": { body: { folders: [], documents: [] } },
  "/recents": { body: [] },
  "/trash": { body: { folders: [], documents: [] } },
};

function HostButton(props: SkinButtonProps): ReactElement {
  const { children, onClick, disabled } = props;
  return (
    <button
      type="button"
      data-host-button=""
      disabled={disabled === true}
      onClick={onClick}
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      {...(props["aria-label"] !== undefined ? { "aria-label": props["aria-label"] } : {})}
    >
      {children}
    </button>
  );
}

describe("the skin component registry", () => {
  it("a Button registered once at the host reskins the upload FAB — no pair wiring", async () => {
    const { wrapper: Inner } = harness(wire(FULL));
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <SkinProvider components={{ Button: HostButton }}>
        <Inner>{children}</Inner>
      </SkinProvider>
    );
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    const fab = await screen.findByTestId("drive-upload-fab");
    expect(fab.hasAttribute("data-host-button")).toBe(true);
  });

  it("without a provider the FAB stays the antd default", async () => {
    const { wrapper } = harness(wire(FULL));
    render(<DriveScreen workspaceId={WORKSPACE_ID} />, { wrapper });
    const fab = await screen.findByTestId("drive-upload-fab");
    expect(fab.hasAttribute("data-host-button")).toBe(false);
    expect(fab.className).toContain("ant-btn");
  });
});
