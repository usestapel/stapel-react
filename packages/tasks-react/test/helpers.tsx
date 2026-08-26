import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { TasksProvider, createTasksRuntime } from "../src/index.js";
import type { CreateTasksRuntimeOptions } from "../src/index.js";
import { registerTasksI18n } from "../src/i18n/keys.js";
import { registerTasksI18nRu } from "../src/i18n/ru.js";
import { registerTasksI18nEs } from "../src/i18n/es.js";

export const BOARD_ID = "board-1";
export const TASK_ID = "task-1";

/** A route→answer table for {@link routedFetch}, matched by URL substring. */
export type Routes = Readonly<
  Record<string, unknown | readonly [number, unknown]>
>;

/**
 * A canned `fetch`: the WIRE is mocked, the client and every hook above it are
 * real. Matching is by substring in declaration order, so a specific route
 * (`boards/x/cards`) must be declared before the general one (`boards`).
 */
export function routedFetch(routes: Routes): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let status = 200;
    let body: unknown = {};
    for (const [suffix, answer] of Object.entries(routes)) {
      if (!url.includes(suffix)) continue;
      if (
        Array.isArray(answer) &&
        answer.length === 2 &&
        typeof answer[0] === "number"
      ) {
        status = answer[0];
        body = answer[1];
      } else {
        body = answer;
      }
      break;
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
}

/**
 * Make `matchMedia` answer against a chosen width, the way
 * `packages/tokens-antd/test/env.tsx` does: `SkinDialog`/`SkinTheme` and core's
 * `useBreakpoint` read `(min-width: N)`, and jsdom's stub answers `false` to
 * everything — which would make every surface a phone by accident rather than
 * by test.
 */
export function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      const matches = min !== null ? width >= Number(min[1]) : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  });
  window.dispatchEvent(new Event("resize"));
}

export function Harness(props: {
  children: ReactNode;
  locale?: string;
  fetch?: typeof globalThis.fetch;
  runtime?: Partial<CreateTasksRuntimeOptions>;
}): ReactElement {
  const locale = props.locale ?? "en";
  const engine = createI18n({ locale });
  registerTasksI18n(engine);
  if (locale === "ru") registerTasksI18nRu(engine);
  if (locale === "es") registerTasksI18nEs(engine);
  const runtime = createTasksRuntime({
    baseUrl: "/tasks/api/v1/",
    fetch: props.fetch ?? routedFetch({}),
    ...props.runtime,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={engine}>
        <TasksProvider runtime={runtime}>{props.children}</TasksProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
