// @vitest-environment jsdom
/**
 * The designed state arms — `ErrorAlert`, `EmptyState`, `LoadBoundary`,
 * `LoadList` — tested where they are declared. Every sentence they render
 * comes from core's floor: the host registers nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { loadFailed, loadLoading, loadReady, parseErrorEnvelope } from "@stapel/core";
import { EmptyState, ErrorAlert, LoadBoundary, LoadList } from "../src/skin.js";
import { Host, installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
  setViewport(1280);
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
});

/** What the wire delivers for a Django 500 under DEBUG=False. */
const bodiless500 = (): Error => parseErrorEnvelope(500, "<h1>Server Error (500)</h1>");

describe("ErrorAlert", () => {
  it("renders nothing for nothing — undefined and null in every source", () => {
    const { container } = render(
      <Host>
        <ErrorAlert error={undefined} thrown={null} />
      </Host>
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders a described error: sentence at weight, detail muted", () => {
    render(
      <Host>
        <ErrorAlert error={{ message: "Could not save.", detail: "HTTP 409" }} testId="err" />
      </Host>
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Could not save.");
    expect(alert.textContent).toContain("HTTP 409");
    expect(alert.getAttribute("data-stapel-error")).toBe("block");
  });

  it("folds a raw thrown value through core's dialect — never the transport's message", () => {
    render(
      <Host>
        <ErrorAlert thrown={bodiless500()} />
      </Host>
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).not.toContain("Request failed with status");
    expect(alert.textContent).toContain("on our side");
    expect(alert.textContent).toContain("HTTP 500");
  });

  it("offers the retry beside the bad news, labelled from the floor in the host's locale", () => {
    const onRetry = vi.fn();
    render(
      <Host locale="ru">
        <ErrorAlert message="x" onRetry={onRetry} />
      </Host>
    );
    const retry = screen.getByRole("button", { name: "Повторить" });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(retry.getAttribute("data-analytics")).toBe("none");
  });

  it("is dismissible only when asked, with an accessible name from the floor", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <Host locale="es">
        <ErrorAlert message="x" />
      </Host>
    );
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
    rerender(
      <Host locale="es">
        <ErrorAlert message="x" onDismiss={onDismiss} />
      </Host>
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("inline variant is one alert line with its actions, no box", () => {
    const onRetry = vi.fn();
    render(
      <Host>
        <ErrorAlert
          variant="inline"
          message="Too short."
          onRetry={onRetry}
          action={<a href="/help">help</a>}
          testId="inline"
        />
      </Host>
    );
    const line = screen.getByRole("alert");
    expect(line.getAttribute("data-stapel-error")).toBe("inline");
    expect(line.textContent).toContain("Too short.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByText("help").closest("[role=alert]")).toBe(line);
  });
});

describe("EmptyState", () => {
  it("titles itself from the floor when the caller has nothing better", () => {
    render(
      <Host locale="es">
        <EmptyState testId="empty" />
      </Host>
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Aún no hay nada aquí");
    expect(status.getAttribute("aria-labelledby")).toBe(
      status.querySelector("[id]")?.getAttribute("id")
    );
  });

  it("carries the pair's own title, hint and door", () => {
    render(
      <Host>
        <EmptyState title="No drafts yet" hint="Start one from a listing." action={<button>Create</button>} />
      </Host>
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("No drafts yet");
    expect(status.textContent).toContain("Start one from a listing.");
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    expect(status.textContent).not.toContain("Nothing here yet");
  });
});

describe("LoadBoundary", () => {
  it("renders a labelled busy region while loading", () => {
    render(
      <Host>
        <LoadBoundary state={loadLoading()} testId="lb">
          {() => <p>never</p>}
        </LoadBoundary>
      </Host>
    );
    const busy = screen.getByRole("status");
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.getAttribute("aria-label")).toBe("Loading");
    expect(busy.getAttribute("data-stapel-load-state")).toBe("loading");
    expect(screen.queryByText("never")).toBeNull();
  });

  it("renders the failure through ErrorAlert with the retry wired", () => {
    const onRetry = vi.fn();
    render(
      <Host>
        <LoadBoundary state={loadFailed(bodiless500())} onRetry={onRetry}>
          {() => <p>never</p>}
        </LoadBoundary>
      </Host>
    );
    expect(screen.getByRole("alert").textContent).toContain("on our side");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hands the ready arm its data and no wrapper", () => {
    const { container } = render(
      <Host>
        <LoadBoundary state={loadReady({ name: "Ada" })}>
          {(user) => <p>{user.name}</p>}
        </LoadBoundary>
      </Host>
    );
    expect(container.firstElementChild?.tagName).toBe("P");
    expect(screen.getByText("Ada")).toBeTruthy();
  });

  it("custom arms replace the defaults", () => {
    render(
      <Host>
        <LoadBoundary
          state={loadFailed(new Error("boom"))}
          loading={<p>custom loading</p>}
          failed={() => <p>custom failed</p>}
        >
          {() => <p>never</p>}
        </LoadBoundary>
      </Host>
    );
    expect(screen.getByText("custom failed")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("LoadList", () => {
  it("routes an empty SUCCESSFUL load to the empty arm, defaulting to EmptyState", () => {
    render(
      <Host>
        <LoadList state={loadReady<readonly string[]>([])}>{(items) => <p>{items[0]}</p>}</LoadList>
      </Host>
    );
    expect(screen.getByRole("status").textContent).toContain("Nothing here yet");
  });

  it("never renders the empty arm for a failed load", () => {
    render(
      <Host>
        <LoadList state={loadFailed(bodiless500())} empty={<p>nothing here</p>}>
          {(items) => <p>{items[0]}</p>}
        </LoadList>
      </Host>
    );
    expect(screen.queryByText("nothing here")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("hands the ready arm a non-empty array", () => {
    render(
      <Host>
        <LoadList state={loadReady<readonly string[]>(["first", "second"])}>
          {(items) => <p>{items[0]}</p>}
        </LoadList>
      </Host>
    );
    expect(screen.getByText("first")).toBeTruthy();
  });
});
