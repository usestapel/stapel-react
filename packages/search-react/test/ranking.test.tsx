import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RankingDisclosurePane } from "../src/default/index.js";
import { RANKING } from "./fixtures.js";
import { TestProviders, mockServer } from "./harness.js";

describe("the P2B Art. 5 disclosure", () => {
  it("lists the parameters with their weights", async () => {
    const server = mockServer({ "/ranking": { body: RANKING } });
    render(
      <TestProviders server={server}>
        <RankingDisclosurePane type="listing" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("ranking-list")).toBeTruthy();
    });
    expect(server.lastQuery("/ranking")?.get("type")).toBe("listing");
    const text = screen.getByTestId("ranking-list").textContent ?? "";
    expect(text).toContain("Text match.");
    expect(text).toContain("Closer first.");
  });

  it("lists a parameter the engine cannot evaluate, with the reason", async () => {
    // Filtering it out would disclose a ranking the site does not use.
    const server = mockServer({ "/ranking": { body: RANKING } });
    render(
      <TestProviders server={server}>
        <RankingDisclosurePane type="listing" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("ranking-inactive")).toBeTruthy();
    });
    expect(screen.getByTestId("ranking-inactive").textContent).toContain(
      "engine cannot evaluate distance"
    );
  });

  it("distinguishes 'no parameters declared' from 'we could not fetch it'", async () => {
    const empty = mockServer({
      "/ranking": {
        body: { doc_type: "listing", backend: "naive", scorers: [], notes: [] },
      },
    });
    const { unmount } = render(
      <TestProviders server={empty}>
        <RankingDisclosurePane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("ranking-empty")).toBeTruthy();
    });
    unmount();

    const failing = mockServer({ "/ranking": { status: 503, body: {} } });
    render(
      <TestProviders server={failing}>
        <RankingDisclosurePane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("ranking-failed")).toBeTruthy();
    });
    expect(screen.queryByTestId("ranking-empty")).toBeNull();
  });

  it("omits `type` from the request when the host names none", async () => {
    const server = mockServer({ "/ranking": { body: RANKING } });
    render(
      <TestProviders server={server}>
        <RankingDisclosurePane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("ranking-list")).toBeTruthy();
    });
    expect(server.lastQuery("/ranking")?.has("type")).toBe(false);
  });
});
