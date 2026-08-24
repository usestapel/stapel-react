/**
 * An unfilled render slot must be SEEN in development and be NOTHING in
 * production — never silent nothing in both.
 *
 * A pair's screen takes render slots from its container (`renderCategoryPicker`,
 * `renderCurrencyField`, a header extra) so the pair does not choose the
 * host's widget for it. When the host forgets one, today's shape is
 * `props.renderX !== undefined ? props.renderX(slot) : null` — and `null` is
 * the whole problem: the composer mounts, the category is simply absent, and
 * nobody learns that a required field has no control until a person cannot
 * submit. The absence of a slot is not a layout choice; it is an integration
 * defect, and the place to find one is the developer's screen, not the user's.
 *
 * ## Why this lives in `@stapel/core`, not in the antd skin
 *
 * The slot CONTRACT is declared by headless and skin layers alike, and the
 * headless layer must not import a design system. A MUI host, a Tailwind
 * host and the antd default skin all leave slots unfilled the same way, so
 * the placeholder has to render with no design-system dependency — it paints
 * with `@stapel/tokens` custom properties only (`border`, `text-muted`,
 * `surface-sunken`), which every host already loads through `tokens.css`,
 * and it is a few lines of JSX, well inside core's size budget. Putting it in
 * `@stapel/tokens-antd/skin` would make the one component whose job is to
 * catch a missing integration unreachable from exactly the layer that
 * declares the integration.
 *
 * ## The dev/prod switch
 *
 * `process.env.NODE_ENV` is the one signal every bundler in the fleet
 * replaces statically (Vite and esbuild define it for dependency code as
 * well as app code; that is what makes React's own dev warnings vanish in a
 * production build). Read inside a `try`, so an environment with no bundler
 * and no `process` global resolves to "production" — hidden — rather than
 * throwing out of a render. `visibility` overrides the build for a demo or
 * a test that must show the placeholder in a production-built showcase.
 */
import type { ReactElement } from "react";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { useT } from "./i18n.js";
import { STAPEL_UI_KEYS } from "./i18n/coreUi.js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Is this a development build? `true` under a dev bundler, in tests and in
 * plain Node; `false` in a production bundle and wherever nothing defined
 * `process.env.NODE_ENV` at all.
 */
export function isDevBuild(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export interface SlotPlaceholderProps {
  /** The slot's name as the host would spell it — the prop it forgot
   * (`renderCategoryPicker`). It is the whole message. */
  readonly name: string;
  /**
   * `"auto"` (default) follows the build: visible in development, nothing in
   * production. `"visible"`/`"hidden"` pin it — for a showcase built in
   * production mode, and for tests of the production behaviour.
   */
  readonly visibility?: "auto" | "visible" | "hidden";
  readonly "data-testid"?: string;
}

/**
 * The visible, named stand-in for a render slot the host did not fill.
 *
 * ```tsx
 * {props.renderCategoryPicker !== undefined
 *   ? props.renderCategoryPicker(slot)
 *   : <SlotPlaceholder name="renderCategoryPicker" />}
 * ```
 *
 * Renders `null` in production. In development it is a dashed, muted box
 * naming the slot, stamped `data-stapel-slot="<name>"` so a package's test
 * can prove which slots its screen exposes.
 */
export function SlotPlaceholder(props: SlotPlaceholderProps): ReactElement | null {
  const t = useT();
  const visibility = props.visibility ?? "auto";
  const shown = visibility === "visible" || (visibility === "auto" && isDevBuild());
  if (!shown) return null;
  return (
    <div
      role="note"
      data-stapel-slot={props.name}
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      style={{
        border: `1px dashed ${cssVar("border")}`,
        borderRadius: radii.md,
        padding: `${String(spacing["2"])}px ${String(spacing["3"])}px`,
        color: cssVar("text-muted"),
        background: cssVar("surface-sunken"),
        fontFamily: cssVar("font-family-mono"),
        fontSize: cssVar("font-size-sm"),
      }}
    >
      {t(STAPEL_UI_KEYS.slotUnfilled, { name: props.name })}
    </div>
  );
}
