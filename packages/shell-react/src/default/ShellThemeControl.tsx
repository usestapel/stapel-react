/**
 * `<ShellThemeControl/>` — the theme switch as CHROME, not as a widget a host
 * remembers to mount.
 *
 * `@stapel/shell-react/theme` has shipped the whole mechanism for two waves:
 * `ThemeModeControl` (the three-state control — since 0.14.0 a compact icon
 * button by default, `variant="settings"` for the three-label segmented
 * track), `useThemePreference` (apply +
 * follow the OS), `readStoredThemePreference` / `applyThemePreference` (the
 * cache). Every token file in the fleet carries a `{light,dark}` pair and
 * compiles a `[data-theme="dark"]` block. And no deployment had a way to reach
 * dark, because nothing in the default chrome rendered the control: a
 * mechanism with no place is a mechanism nobody has. This component is that
 * place — `AppShell` and `PublicShell` render it by default (§83: default
 * skins ARE the product), and a host opts out with `themeControl={false}`.
 *
 * ── What "self-managing" means here ──────────────────────────────────────────
 *
 * `ThemeModeControl` is deliberately prop-driven: it renders in hosts that
 * translate elsewhere and store the preference in a profile field, so it reads
 * nothing and writes nothing. That contract is right for the control and wrong
 * for the chrome — a shell cannot ask its host for a value the host has no
 * reason to hold. So this wrapper owns the three things the bare control does
 * not: the cached preference it starts from, applying it (and following the OS
 * while it says `system`), and writing the choice back.
 *
 * ── Why it does not paint a state it has not read yet ────────────────────────
 *
 * `readStoredThemePreference()` is a promise (the repository is async), and the
 * naive shape — start at `"system"`, apply immediately, correct on resolve —
 * is a white flash on every dark deployment: it re-stamps the document a frame
 * after a host's pre-paint boot script stamped it correctly. So NOTHING is
 * applied until the stored preference is known: the applier mounts only then
 * (`<StoredPreferenceApplier/>`), and until it does the control simply MARKS
 * the mode the document is already in — which is the true statement about the
 * page, not a guess about the person. A stored `light`/`dark` therefore paints
 * marked correctly on the first frame; a stored `system` shows the side it
 * resolves to for a tick and then moves its mark to the half-disc.
 *
 * Copy comes from core's engine (`useT`) rather than from the English floor:
 * the wrapper lives inside the shells, which already require an
 * `<I18nProvider>` — the bare `ThemeModeControl` keeps its prop-driven labels
 * for hosts that do not.
 */
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useT } from "@stapel/core";
import {
  ThemeModeControl,
  applyThemePreference,
  readStoredThemePreference,
  useDocumentThemeMode,
  useThemePreference,
} from "../theme/index.js";
import type { ThemeModeControlVariant, ThemePreference } from "../theme/index.js";
import { SHELL_I18N_KEYS } from "../i18n/keys.js";

export interface ShellThemeControlProps {
  /**
   * `"compact"` (the default) — one icon button that cycles
   * light → dark → system, which is what the chrome mounts in its header,
   * `Sider` foot and nav sheet. `"settings"` — the three-label segmented
   * control, for a host's own appearance setting.
   *
   * Forwarded verbatim: the DEFAULT lives in `<ThemeModeControl/>`, so the
   * two ways to reach this control cannot drift apart.
   */
  readonly variant?: ThemeModeControlVariant;
  /** Icon size, any CSS length. Forwarded to `<ThemeModeControl/>`. */
  readonly size?: string;
  readonly className?: string;
  /** Mirror the accessible name into a `title`. Off by default. */
  readonly tooltip?: boolean;
  /** Test/host hook. Defaults to `shell-theme-control`. */
  readonly "data-testid"?: string;
}

const DEFAULT_TEST_ID = "shell-theme-control";

/**
 * Applying is a side effect with an owner, and the owner is this three-line
 * component: it mounts only once the stored preference is known, which is what
 * keeps the shell from stamping a guess over a boot script's correct answer.
 * (A hook cannot be called conditionally; a component can be rendered
 * conditionally, which is the same decision expressed where React allows it.)
 */
function StoredPreferenceApplier({
  preference,
}: {
  readonly preference: ThemePreference;
}): null {
  useThemePreference(preference);
  return null;
}

/** The theme switch the default chrome renders: reads the cache, applies it,
 * follows the OS while it says `system`, writes the choice back. */
export function ShellThemeControl(props: ShellThemeControlProps): ReactElement {
  const t = useT();
  const documentMode = useDocumentThemeMode();
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    let live = true;
    void readStoredThemePreference().then((stored) => {
      // `current ?? stored`: a person who pressed the control before the cache
      // answered has already said what they want, and a late read must not
      // overrule them.
      if (live) setPreference((current) => current ?? stored);
    });
    return () => {
      live = false;
    };
  }, []);

  const onChange = useCallback((next: ThemePreference): void => {
    setPreference(next);
    // Persisted here rather than left to the applier's effect, so the choice
    // survives a navigation that unmounts the chrome in the same tick.
    applyThemePreference(next);
  }, []);

  return (
    <>
      {preference !== null && <StoredPreferenceApplier preference={preference} />}
      <ThemeModeControl
        value={preference ?? documentMode}
        onChange={onChange}
        labels={{
          group: t(SHELL_I18N_KEYS.themeGroup),
          light: t(SHELL_I18N_KEYS.themeLight),
          dark: t(SHELL_I18N_KEYS.themeDark),
          system: t(SHELL_I18N_KEYS.themeSystem),
          // Handed over UNRESOLVED, `{current}`/`{next}` still in it: the
          // control interpolates the state names it already holds, so the
          // sentence keeps the translator's word order and this wrapper does
          // not have to recompute a name on every click.
          cycle: t(SHELL_I18N_KEYS.themeCycle),
        }}
        {...(props.variant !== undefined ? { variant: props.variant } : {})}
        {...(props.tooltip !== undefined ? { tooltip: props.tooltip } : {})}
        {...(props.size !== undefined ? { size: props.size } : {})}
        {...(props.className !== undefined ? { className: props.className } : {})}
        data-testid={props["data-testid"] ?? DEFAULT_TEST_ID}
      />
    </>
  );
}
