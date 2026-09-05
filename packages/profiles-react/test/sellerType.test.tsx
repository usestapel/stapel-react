/**
 * `seller_type` — "am I buying from a person or from a shop", on the read that
 * already answers who they are (stapel-profiles 0.19.0).
 *
 * A storefront asking that question had to make a second lookup into the
 * comm-layer projection, which is the only place the capacity was exposed. It
 * is now on `GET /{user_id}` and on `POST /batch`, so a seller card and a
 * profile page read one answer.
 *
 * The interesting half is the LABEL. `private` and `business` are wire values,
 * not captions: printing "business" over a seller card in a Russian storefront
 * is an English word for a Russian shop. And `null` is deliberately ambiguous
 * on the wire — "this deployment's profile model has no such field" and
 * "nobody declared one" are indistinguishable, because neither is something a
 * caller should act on — so it renders as nothing at all rather than as a
 * guess.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import {
  PublicProfilePage,
  sellerTypeLabel,
  sellerTypeLabelKey,
} from "../src/default/index.js";
import { PROFILES_I18N_KEYS, registerProfilesI18n } from "../src/i18n/keys.js";
import { registerProfilesI18nRu } from "../src/i18n/ru.js";
import { registerProfilesI18nEs } from "../src/i18n/es.js";

const BASE = "https://profiles.stapel.test/profiles/api/v1";
const ALICE = "b3f1c0de-0000-4000-8000-0000000000a1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function publicProfile(sellerType: string | null): Record<string, unknown> {
  return {
    user_id: ALICE,
    display_name: "Алиса",
    avatar: null,
    bio: null,
    location_display_name_narrow: null,
    location_display_name_broad: null,
    followers_count: 0,
    following_count: 0,
    relationship_status: "neutral",
    seller_type: sellerType,
  };
}

/** The follow/block control reads this beside the profile; the page under test
 * is not about it, and an unhandled request is noise in every run. */
function relationshipHandler(): ReturnType<typeof http.get> {
  return http.get(`${BASE}/${ALICE}/relationship`, () =>
    HttpResponse.json({ status: "neutral", is_following: false, is_blocked: false })
  );
}

function Harness(props: {
  readonly children: ReactNode;
  readonly locale?: string;
}): ReactElement {
  const i18n = createI18n({ locale: props.locale ?? "en" });
  registerProfilesI18n(i18n);
  registerProfilesI18nRu(i18n);
  registerProfilesI18nEs(i18n);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const runtime = createProfilesRuntime({ baseUrl: BASE });
  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ProfilesProvider runtime={runtime}>{props.children}</ProfilesProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

describe("the label helper", () => {
  it("maps the two shipped capacities onto keys", () => {
    expect(sellerTypeLabelKey("private")).toBe(
      PROFILES_I18N_KEYS.sellerTypePrivate
    );
    expect(sellerTypeLabelKey("business")).toBe(
      PROFILES_I18N_KEYS.sellerTypeBusiness
    );
  });

  it("says NOTHING for the wire's ambiguous null", () => {
    // `null` is "no such field on this deployment" AND "nobody declared one",
    // and a caller cannot tell them apart. Neither is a fact to print.
    expect(sellerTypeLabelKey(null)).toBeUndefined();
    expect(sellerTypeLabel((key) => key, null)).toBeUndefined();
    expect(sellerTypeLabel((key) => key, undefined)).toBeUndefined();
    expect(sellerTypeLabel((key) => key, "")).toBeUndefined();
  });

  it("falls through to a deployment's own capacity rather than inventing a word", () => {
    // A third registered value gets no key: the raw value stays on screen,
    // which is the honest bottom of every label ladder in this fleet.
    expect(sellerTypeLabelKey("dealer")).toBeUndefined();
    expect(sellerTypeLabel((key) => key, "dealer")).toBe("dealer");
  });

  it("carries a word in every locale this package ships", () => {
    const cases: readonly (readonly [string, string, string])[] = [
      ["en", "Private individual", "Company"],
      ["ru", "Частное лицо", "Компания"],
      ["es", "Particular", "Empresa"],
    ];
    for (const [locale, priv, business] of cases) {
      const i18n = createI18n({ locale });
      registerProfilesI18n(i18n);
      registerProfilesI18nRu(i18n);
      registerProfilesI18nEs(i18n);
      const t = (key: string): string => i18n.t(key);
      expect(sellerTypeLabel(t, "private")).toBe(priv);
      expect(sellerTypeLabel(t, "business")).toBe(business);
    }
  });
});

describe("<PublicProfilePage> draws the capacity", () => {
  it("names a company in the reader's own language", async () => {
    server.use(
      http.get(`${BASE}/${ALICE}`, () =>
        HttpResponse.json(publicProfile("business"))
      ),
      relationshipHandler()
    );
    render(
      <Harness locale="ru">
        <PublicProfilePage userId={ALICE} />
      </Harness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("public-profile-seller-type").textContent).toBe(
        "Компания"
      );
    });
  });

  it("draws nothing at all when the deployment says nothing", async () => {
    server.use(
      http.get(`${BASE}/${ALICE}`, () => HttpResponse.json(publicProfile(null))),
      relationshipHandler()
    );
    render(
      <Harness>
        <PublicProfilePage userId={ALICE} />
      </Harness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("public-profile-identity")).toBeTruthy();
    });
    expect(screen.queryByTestId("public-profile-seller-type")).toBeNull();
  });
});
