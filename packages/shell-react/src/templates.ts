/**
 * The shell templates: a named chrome plus the closed list of slots it
 * renders, against `@stapel/core`'s `SHELL_SLOT_IDS`. Pure data, mirrored by
 * the published `shell-templates.json` (a test holds the two equal) so a
 * scaffold reads the table without importing React.
 *
 * `exclusive` lists the capacity-one slots of the template: two embeds
 * claiming one of them are a conflict the scaffold refuses, never a
 * first-wins.
 */
import type { ShellSlotId } from "@stapel/core";

export type ShellTemplateId = "topbar-sidenav" | "topbar-only" | "sidenav-only";

export interface ShellTemplate {
  /** The `/default` component that renders it; `null` while queued. */
  readonly chrome: "AppShell" | "PublicShell" | null;
  readonly slots: readonly ShellSlotId[];
  readonly exclusive: readonly ShellSlotId[];
  readonly status: "shipped" | "queued";
}

export const SHELL_TEMPLATES: Readonly<Record<ShellTemplateId, ShellTemplate>> = {
  "topbar-sidenav": {
    chrome: "AppShell",
    slots: [
      "topbar.start",
      "topbar.center",
      "topbar.end",
      "sidenav.head",
      "sidenav.foot",
      "sheet.foot",
    ],
    exclusive: ["topbar.center"],
    status: "shipped",
  },
  "topbar-only": {
    chrome: "PublicShell",
    slots: ["topbar.start", "topbar.center", "topbar.end", "browsebar", "footer", "bottombar"],
    exclusive: ["topbar.center", "browsebar", "footer"],
    status: "shipped",
  },
  "sidenav-only": {
    chrome: null,
    slots: ["sidenav.head", "sidenav.foot", "sheet.foot", "page.actions"],
    exclusive: [],
    status: "queued",
  },
};
