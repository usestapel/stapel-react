import { describe } from "vitest";
import rule from "../rules/no-reserved-backend-route.js";
import { tsxTester, RESERVED_PATH_SETTINGS } from "./helpers.js";

describe("no-reserved-backend-route", () => {
  tsxTester().run("stapel/no-reserved-backend-route", rule, {
    valid: [
      // Canon: a bare module root is the frontend's — never flagged, even
      // though "/calendar/api" and "/calendar/swagger" are reserved.
      {
        code: `const el = <Route path="/calendar" element={<CalendarPage />} />;`,
        settings: RESERVED_PATH_SETTINGS,
      },
      // A nested/relative segment that just happens to start with the same
      // word but isn't the reserved sub-path.
      {
        code: `const el = <Route path="/calendar-archive" element={<Archive />} />;`,
        settings: RESERVED_PATH_SETTINGS,
      },
      // Object route config: bare module root, no collision.
      {
        code: `const routes = [{ path: "/calendar", element: <CalendarPage /> }];`,
        settings: RESERVED_PATH_SETTINGS,
      },
      // createBrowserRouter with a bare-root route.
      {
        code: `createBrowserRouter([{ path: "/billing", Component: BillingPage }]);`,
        settings: RESERVED_PATH_SETTINGS,
      },
      // Dynamic path — can't statically decide, false-positive policy skips it.
      {
        code: `const el = <Route path={dynamicPath} element={<X />} />;`,
        settings: RESERVED_PATH_SETTINGS,
      },
      // A plain object with a "path" key but no route shape and not inside a
      // router-factory call — not a route config (avoids false positives on
      // unrelated config objects).
      {
        code: `const cfg = { path: "/admin" };`,
        settings: RESERVED_PATH_SETTINGS,
      },
      // No reserved-paths.json (and no settings override) → no-op, never falls.
      {
        code: `const el = <Route path="/admin" element={<X />} />;`,
      },
    ],
    invalid: [
      // JSX: route path falls into the reserved /<mod>/api/… sub-path — the
      // "bare root stays yours" variant of the message.
      {
        code: `const el = <Route path="/calendar/api/x" element={<X />} />;`,
        settings: RESERVED_PATH_SETTINGS,
        errors: [{ messageId: "reservedSubPath" }],
      },
      // JSX: global /admin reservation — no bare-root carve-out.
      {
        code: `const el = <Route path="/admin" element={<Admin />} />;`,
        settings: RESERVED_PATH_SETTINGS,
        errors: [{ messageId: "reservedGlobal" }],
      },
      // JSX: global /staticfiles/… reservation, nested segment.
      {
        code: `const el = <Route path="/staticfiles/theme.css" element={<X />} />;`,
        settings: RESERVED_PATH_SETTINGS,
        errors: [{ messageId: "reservedGlobal" }],
      },
      // JSX: /media exact match.
      {
        code: `const el = <Route path="/media" element={<X />} />;`,
        settings: RESERVED_PATH_SETTINGS,
        errors: [{ messageId: "reservedGlobal" }],
      },
      // Object route config (RouteObject shape) reserved sub-path.
      {
        code: `const routes = [{ path: "/calendar/swagger", element: <Docs /> }];`,
        settings: RESERVED_PATH_SETTINGS,
        errors: [{ messageId: "reservedSubPath" }],
      },
      // createBrowserRouter array literal — bare path property (no sibling
      // route-shape key) still caught via router-factory-call context.
      {
        code: `createBrowserRouter([{ path: "/billing/api" }]);`,
        settings: RESERVED_PATH_SETTINGS,
        errors: [{ messageId: "reservedSubPath" }],
      },
      // Nested children route under a reserved sub-path — no route-shape
      // sibling on the inner object, so only the router-factory-call
      // traversal (through the "children" array nesting) catches it.
      {
        code: `createBrowserRouter([{ path: "/app", children: [{ path: "/admin" }] }]);`,
        settings: RESERVED_PATH_SETTINGS,
        errors: [{ messageId: "reservedGlobal" }],
      },
      // Template literal with a reserved static prefix.
      {
        code: "const el = <Route path={`/calendar/api/${id}`} element={<X />} />;",
        settings: RESERVED_PATH_SETTINGS,
        errors: [{ messageId: "reservedSubPath" }],
      },
    ],
  });
});
