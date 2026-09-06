/**
 * Shared harness for the brick-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours, no raw dimensions, no hardcoded prose.
 *
 * What a console needs to be demoed is small and specific:
 *
 *  - an i18n engine carrying the package's own English floor, because that is
 *    how a host mounts it (the components fall back to the same bundle without
 *    one, and a demo that relied on the fallback would be documenting the
 *    fallback rather than the product);
 *  - a HIGH-SCORE STORE that remembers nothing. The real one writes to the
 *    browser's `localStorage`, and a showcase whose "Best" column climbs every
 *    time somebody opens the page is a showcase that photographs differently
 *    on every run;
 *  - a fixed SEED per variant, for the same reason: the deal has to be the
 *    same deal every time the story is opened or shot.
 */
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import {
  createNullHighScoreStore,
  registerBrickI18n,
} from "../src/index.js";
import type { HighScoreStore } from "../src/index.js";

/** Demo-local copy — a `demo.*` (unmanaged) namespace, so `i18n-key-exists`
 * treats it as app-local and never false-positives. */
const demoBundleEn: Record<string, string> = {
  "demo.room.title": "Design review",
  "demo.room.lead": "The host has been told you are here.",
  "demo.room.admitted": "You are in. Say hello.",
  "demo.upload.title": "Analysing the recording",
  "demo.upload.lead": "About two minutes for a 40-minute call.",
  "demo.score.caption": "Last run",
};

export const DEMO_KEYS = {
  roomTitle: "demo.room.title",
  roomLead: "demo.room.lead",
  roomAdmitted: "demo.room.admitted",
  uploadTitle: "demo.upload.title",
  uploadLead: "demo.upload.lead",
  scoreCaption: "demo.score.caption",
} as const;

/** A store that answers 0 and forgets everything — see the file header. */
export const demoHighScores: HighScoreStore = createNullHighScoreStore();

/** The seed every variant deals from. */
export const DEMO_SEED = 20260907;

function demoI18n(): ReturnType<typeof createI18n> {
  const engine = createI18n({ locale: "en" });
  registerBrickI18n(engine);
  engine.registerBundle("en", demoBundleEn);
  return engine;
}

/** Wrap a variant the way a host mounts the console. */
export function ConsoleFrame(props: { children: ReactNode }): ReactElement {
  return (
    <I18nProvider i18n={demoI18n()}>
      <div style={{ padding: spacing[4], background: cssVar("surface") }}>
        {props.children}
      </div>
    </I18nProvider>
  );
}

/**
 * The card a waiting screen actually is: a title, a line of reassurance, and
 * whatever the host puts underneath. The console goes in the slot; without the
 * card around it the demo would be documenting a component floating in space.
 */
export function WaitingCard(props: {
  readonly title: string;
  readonly lead: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div
      style={{
        display: "grid",
        justifyItems: "center",
        gap: spacing[3],
        padding: spacing[5],
        maxWidth: 520,
        borderRadius: radii.lg,
        border: `1px solid ${cssVar("border-subtle")}`,
        background: cssVar("surface-raised"),
      }}
    >
      <strong style={{ fontSize: fontSize.lg.fontSize, color: cssVar("text") }}>
        {props.title}
      </strong>
      <span
        style={{
          color: cssVar("text-muted"),
          fontSize: fontSize.sm.fontSize,
          textAlign: "center",
        }}
      >
        {props.lead}
      </span>
      {props.children}
    </div>
  );
}
