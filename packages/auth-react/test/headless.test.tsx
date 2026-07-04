import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createAuthRuntime } from "../src/model/runtime.js";
import type { AuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { PasswordlessLogin } from "../src/headless/PasswordlessLogin.js";
import { useCapabilities } from "../src/model/queries.js";
import { BASE, authResponse } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrap(runtime: AuthRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider runtime={runtime}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

describe("<PasswordlessLogin> (headless render prop)", () => {
  it("drives request → codeSent → authenticated through the DOM", async () => {
    server.use(
      http.post(`${BASE}/email/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      ),
      http.post(`${BASE}/email/verify/`, () =>
        HttpResponse.json(authResponse("LOGGED_IN"))
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <PasswordlessLogin>
          {({ state, requestCode, submitCode }) => (
            <div>
              <span data-testid="step">{state.step}</span>
              <button onClick={() => requestCode("email", "a@b.com")}>req</button>
              <button onClick={() => submitCode("1234")}>verify</button>
            </div>
          )}
        </PasswordlessLogin>
      )
    );

    expect(screen.getByTestId("step").textContent).toBe("idle");
    screen.getByText("req").click();
    await waitFor(() =>
      expect(screen.getByTestId("step").textContent).toBe("codeSent")
    );
    screen.getByText("verify").click();
    await waitFor(() =>
      expect(screen.getByTestId("step").textContent).toBe("authenticated")
    );
    expect(runtime.session.getState().status).toBe("authenticated");
  });
});

describe("useCapabilities (model hook)", () => {
  it("fetches and returns the capability matrix", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json({
          registration: {
            phone: true,
            email: true,
            password: true,
            oauth: [],
            sso: false,
            anonymous: false,
          },
          login: {
            phone: true,
            email: false,
            password: true,
            oauth: [],
            sso: false,
            qr: false,
            passkey: false,
            magic_link: false,
          },
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    function Probe(): ReactElement {
      const { data } = useCapabilities();
      return <span data-testid="caps">{data ? String(data.login.password) : "…"}</span>;
    }
    render(wrap(runtime, <Probe />));
    await waitFor(() =>
      expect(screen.getByTestId("caps").textContent).toBe("true")
    );
  });
});
