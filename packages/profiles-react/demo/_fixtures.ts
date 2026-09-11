/**
 * Canned bodies the skin demos serve through `mockFetch` (`./_harness.js`).
 *
 * They are shaped exactly like stapel-profiles 0.15.0's responses, including
 * the two shapes the visual pass proved nobody had ever drawn: an
 * empty-but-renderable public profile (a registered person who has typed
 * nothing) and a `POST /batch` answer with a `missing` id in it.
 *
 * The people are named, and their ids are all DIFFERENT — the showcase used to
 * photograph three followers as the identical truncated string `b3f1c0de`,
 * which reads as broken data because the fixtures shared a prefix AND the
 * story printed the id instead of the person.
 */

export const SELF_ID = "0a3d1f52-1111-4000-8000-000000000001";
export const ADA_ID = "1c7e4b90-2222-4000-8000-000000000002";
export const GRACE_ID = "2f9a6d13-3333-4000-8000-000000000003";
export const ALAN_ID = "3b5c8e47-4444-4000-8000-000000000004";
/** Registered, provisioned by `user.registered`, has typed nothing yet. */
export const NEWCOMER_ID = "4d1f2a68-5555-4000-8000-000000000005";

/**
 * An 8x8 solid PNG, inline. A demo must never reach the network for a picture
 * — the smoke render runs in jsdom and the showcase photographs offline — and
 * base64 keeps the colour out of the source, where `stapel/no-raw-colors`
 * would (rightly) have something to say about a hex literal.
 */
export const AVATAR_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mOoyluBFTEMLQkAB5FkAVCjVn4AAAAASUVORK5CYII=";

/** A `StapelImageDTO` exactly as the wire spells it: `source` a bare string,
 * `variants` absent. The pair narrows it (`profileAvatarImage`). */
export const AVATAR_IMAGE = {
  source: "file",
  url: AVATAR_PNG,
  mime: "image/png",
  width: 8,
  height: 8,
  aspect: 1,
  square: true,
  preview_b64: null,
};

/** One `ProfilePublicResponse`, with everything a row or a header can draw. */
function publicProfile(input: {
  userId: string;
  displayName: string;
  location?: string;
  followers?: number;
  following?: number;
  rating?: number;
  relationship?: string | null;
  createdAt?: string;
  avatarImage?: Record<string, unknown> | null;
}): Record<string, unknown> {
  return {
    user_id: input.userId,
    display_name: input.displayName,
    avatar_source: "file",
    avatar: null,
    avatar_image: input.avatarImage ?? null,
    // stapel-profiles 0.19.2: tenure is on the public read itself.
    created_at: input.createdAt ?? "2024-03-15T12:00:00Z",
    location_id: null,
    location_display_name_narrow: input.location ?? "",
    location_display_name_broad: input.location ?? "",
    followers_count: input.followers ?? 0,
    following_count: input.following ?? 0,
    rating: input.rating ?? 0,
    relationship_status: input.relationship ?? null,
  };
}

export const ADA = publicProfile({
  userId: ADA_ID,
  displayName: "Ada Lovelace",
  location: "GB - London",
  followers: 128,
  following: 31,
  rating: 4.8,
  relationship: "neutral",
  avatarImage: AVATAR_IMAGE,
});

export const GRACE = publicProfile({
  userId: GRACE_ID,
  displayName: "Grace Hopper",
  location: "US - Arlington",
  followers: 92,
  following: 12,
  relationship: "following",
});

export const ALAN = publicProfile({
  userId: ALAN_ID,
  displayName: "Alan Turing",
  location: "GB - Wilmslow",
  followers: 74,
  following: 5,
  relationship: "neutral",
});

/**
 * The 0.15.0 answer for somebody who registered and stopped there: a real
 * 200 with an empty name and zero counts. Not a 404, and not an error card.
 */
export const NEWCOMER = publicProfile({
  userId: NEWCOMER_ID,
  displayName: "",
  createdAt: "2026-09-01T09:00:00Z",
});

/** `POST /batch` for the followers list — two found, one `missing`. */
export const FOLLOWERS_BATCH = {
  profiles: [ADA, GRACE],
  // Asked about, no profile row: a placeholder, not a failure.
  missing: [ALAN_ID],
};

export const FOLLOWERS_PAGE = {
  followers: [ADA_ID, GRACE_ID, ALAN_ID],
  count: 3,
};

export const FOLLOWING_PAGE = { following: [GRACE_ID], count: 1 };

/** Nobody blocked — the designed empty state, and the good-news one. */
export const BLOCKED_EMPTY: readonly string[] = [];

/** The caller's own full profile (`GET /me`). */
export const MY_PROFILE = {
  user_id: SELF_ID,
  display_name: "Ada Lovelace",
  theme: "system",
  avatar: null,
  avatar_source: "file",
  avatar_image: null,
  app_language: { code: "en", name: "English", flag: "🇬🇧" },
  use_device_language: false,
  understands: ["en", "fr"],
  email_messages: true,
  email_system: false,
  push_messages: true,
  push_system: true,
  initial_setup_passed: true,
  currency_code: "GBP",
};

/** A host that selected two standard fields into its manifest. */
export const FIELD_MANIFEST = [
  {
    name: "currency_code",
    kind: "model_ref",
    docstring: "Preferred currency",
    required: false,
    order: 0,
    enum_values: null,
  },
  {
    name: "email_messages",
    kind: "bool",
    docstring: "Email me about new messages",
    required: false,
    order: 1,
    enum_values: null,
  },
];

export const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

/**
 * `GET /contacts` for a seller with two numbers: one proved by SMS and busy,
 * one still unverified — which is the row the screen has to explain, because
 * an unverified number reaches nobody and nothing else on the row says so.
 *
 * `policies` rides along exactly as the wire sends it: the picker is built
 * from the deployment's own vocabulary, never from three hardcoded strings.
 */
export const CONTACTS = {
  contacts: [
    {
      id: 7,
      kind: "phone",
      value: "+15550100",
      label: "Work",
      policy: "members",
      enabled: true,
      verified: true,
      verified_at: "2026-09-01T09:00:00Z",
      reveal_count: 128,
      created_at: "2026-08-30T08:00:00Z",
    },
    {
      id: 8,
      kind: "phone",
      value: "+15550199",
      label: "Mobile",
      policy: "verified",
      enabled: true,
      verified: false,
      verified_at: null,
      reveal_count: 0,
      created_at: "2026-09-10T08:00:00Z",
    },
  ],
  policies: ["members", "verified", "nobody"],
};

/** A seller who has published nothing yet. */
export const CONTACTS_EMPTY = {
  contacts: [],
  policies: ["members", "verified", "nobody"],
};

/** `GET /contacts/{id}/reveals/summary` — counts, never who asked. */
export const REVEAL_SUMMARY = {
  contact_id: 7,
  total: 128,
  last_24h: 4,
  last_7d: 19,
  last_reveal_at: "2026-09-11T09:30:00Z",
};
