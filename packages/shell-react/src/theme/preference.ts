/**
 * The theme PREFERENCE — three states, one writer.
 *
 * A theme control has three states, not two: `light`, `dark`, and `system`
 * ("follow the device"). `system` is not a third colour — it is a rule that
 * RESOLVES to one of the other two and keeps resolving as the OS changes.
 * Conflating it with the colour it currently resolves to is the defect this
 * module exists to make impossible: {@link resolveThemePreference} is the
 * only place the collapse happens, and it takes the preference as an
 * argument rather than reading it back off the document.
 *
 * ── Why the apply function stamps TWO signals ────────────────────────────
 *
 * The fleet has two theme signals in the wild and they disagree today:
 *
 *   * `data-theme="dark"` on `<html>` — the CANON. `@stapel/tokens`'
 *     generated `tokens.css` keys its dark block on it, and
 *     `@stapel/tokens-antd`'s `resolveThemeMode()` reads it to decide which
 *     side of every colour role a default skin gets. A host that never sets
 *     it serves stock-light antd inside dark chrome.
 *   * a `dark` CLASS on `<html>` — what a Tailwind host uses
 *     (`@custom-variant dark (&:is(.dark *))`), which is most of the fleet's
 *     product frontends.
 *
 * Asking a host to migrate from one to the other is a cutover of its
 * generated CSS and its pre-paint boot script at the same time; making the
 * signal configurable means the first host that wires it wrong is half
 * themed with nothing to catch it. So this function writes BOTH, plus
 * `color-scheme` for the browser's own surfaces, from one call — the states
 * cannot drift because there is only one writer. A host that wants no class
 * passes `darkClasses: []`.
 */
import { createRepository, type Repository } from "@stapel/core";

/** What a person CHOSE. `system` is a rule, not a colour. */
export type ThemePreference = "light" | "dark" | "system";

/** What the page actually RENDERS as — a preference already resolved. */
export type ThemeMode = "light" | "dark";

/** The three states, in the order a control should offer them. */
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];

/**
 * The attribute `@stapel/tokens`' `tokens.css` keys its dark block on, and
 * the one `@stapel/tokens-antd`'s `resolveThemeMode()` reads. Kept as a
 * literal rather than imported so `/theme` needs no token peer; the two are
 * pinned to each other by a test, not by a comment.
 */
export const THEME_ATTRIBUTE = "data-theme";

/** The class a Tailwind host's `dark:` variant keys on, by convention. */
export const DEFAULT_DARK_CLASSES: readonly string[] = ["dark"];

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Preference cache — app scope (survives logout, like locale), never
 * encrypted, pinned to `localStorage`. The default IndexedDB backend is
 * async, and the one reader that matters most is the host's synchronous
 * pre-paint boot script, which has to answer BEFORE the first frame.
 */
const themeRepo: Repository<ThemePreference> = createRepository<ThemePreference>(
  "theme",
  { scope: "app", storage: "local" },
);

const PREFERENCE_KEY = "preference";

/**
 * The raw storage key {@link applyThemePreference} writes
 * (`stapel:repo:<ns>:<key>`, value JSON-encoded). Published because a host's
 * inline boot script runs before any bundle and therefore cannot import this
 * module — it reads this key directly. Nothing inside a bundle should:
 * use {@link readStoredThemePreference}.
 */
export const THEME_PREFERENCE_STORAGE_KEY = "stapel:repo:theme:preference";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** What the OS is asking for right now. `light` where there is no DOM. */
export function systemThemeMode(): ThemeMode {
  if (typeof matchMedia !== "function") return "light";
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Collapse a preference to the mode it renders as — the ONE place `system`
 * becomes a colour. */
export function resolveThemePreference(preference: ThemePreference): ThemeMode {
  return preference === "system" ? systemThemeMode() : preference;
}

/** Which mode the document is CURRENTLY stamped with. Reads the canon
 * attribute, so it agrees with `@stapel/tokens-antd`'s `resolveThemeMode()`
 * by construction. */
export function documentThemeMode(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark"
    ? "dark"
    : "light";
}

/**
 * Everything that wants to know the document was re-stamped. A
 * MutationObserver would also see it, but only on a later microtask — which
 * is one render too late for a control that must never show a mode the page
 * has already left. Notified synchronously; the observer in
 * `useDocumentThemeMode` still covers stamps written by anyone else (a
 * pre-paint boot script, a host's own applier).
 */
const stampListeners = new Set<() => void>();

/** Subscribe to this module's own stamps. Returns an unsubscribe. */
export function subscribeThemeStamp(listener: () => void): () => void {
  stampListeners.add(listener);
  return () => stampListeners.delete(listener);
}

export interface ApplyThemeOptions {
  /** Classes toggled on `<html>` alongside the attribute. Default `["dark"]`
   * (Tailwind's convention); `[]` for a host that wants the attribute only. */
  readonly darkClasses?: readonly string[];
  /** Skip the cache write — for a host that persists elsewhere, and for
   * tests that must not touch storage. */
  readonly persist?: boolean;
}

/**
 * Put *preference* on the document and remember it. Returns the mode it
 * resolved to. See the module doc for why both signals are stamped.
 */
export function applyThemePreference(
  preference: ThemePreference,
  options: ApplyThemeOptions = {},
): ThemeMode {
  const mode = resolveThemePreference(preference);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, mode);
    for (const cls of options.darkClasses ?? DEFAULT_DARK_CLASSES) {
      root.classList.toggle(cls, mode === "dark");
    }
    root.style.colorScheme = mode;
  }
  if (options.persist !== false) {
    // Fire-and-forget: the document is already correct, and the cache only
    // affects the NEXT first paint.
    void themeRepo.set(PREFERENCE_KEY, preference).catch(() => {});
  }
  for (const listener of [...stampListeners]) listener();
  return mode;
}

/** The preference cached from the last session (`system` when unset or when
 * storage is unavailable — private mode, quota). */
export async function readStoredThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await themeRepo.get(PREFERENCE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * Keep following the OS for as long as *preference* is `system`. Returns an
 * unsubscribe; any other preference subscribes to nothing, because a pinned
 * choice must not move when the OS does.
 */
export function watchSystemTheme(
  preference: ThemePreference,
  options: ApplyThemeOptions = {},
): () => void {
  if (preference !== "system" || typeof matchMedia !== "function") {
    return () => {};
  }
  const query = matchMedia(DARK_QUERY);
  const onChange = (): void => {
    applyThemePreference("system", options);
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
