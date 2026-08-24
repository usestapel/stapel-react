/**
 * @stapel/currencies-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * EMPTY, on purpose. This pair owns no page: a currency picker lives in
 * whatever chrome the host already has, a price renders inside somebody else's
 * card, and `RateTable` is a slot a host mounts on a settings screen it owns.
 * A nav entry here would put "Currencies" in the main menu of every app that
 * merely wanted its prices formatted.
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below and writes
 * `nav-manifest.json` plus this package's (empty) slice of the root aggregate.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [];
