/**
 * The default skin's SLOT REGISTRY — the same register/resolve seam the docs
 * pair established, applied to this skin's composition points, so every part
 * is swappable without a fork (a default the customer cannot swap is a
 * decision, not a default):
 *
 * ```ts
 * registerDriveSkinComponent("thumbnail", MyAuthHeaderThumbnail); // at startup
 * ```
 *
 * Resolution: explicit registration > builtin. `unregisterDriveSkinComponent`
 * restores the builtin. The map is typed per slot — a replacement must accept
 * the slot's props, and that contract is what makes a swap safe.
 *
 * `thumbnail` is the slot with a known caller waiting: a host that
 * authenticates by HEADER rather than by cookie cannot use an `<img src>` at
 * an authorized URL, and swaps in a component that fetches the bytes itself.
 * Everything else in this table is here because a product skin's parts should
 * be replaceable one at a time rather than by forking the screen.
 *
 * The share sheet is NOT in this table. Sharing lands with stapel-docs 0.6.0
 * (spec §3.5), and a slot for a component that does not exist would be a
 * promise this package cannot keep — the seam it will need is a new entry
 * here plus a new `/default` export, both additive.
 */
import type { ComponentType } from "react";
import type { DriveBreadcrumbBarProps } from "./DriveBreadcrumbBar.js";
import type { DriveRowActionsProps } from "./DriveRowActions.js";
import type { DriveSearchFieldProps } from "./DriveSearchField.js";
import type { DriveThumbnailProps } from "./DriveThumbnail.js";
import type { DriveTrashPaneProps } from "./DriveTrashPane.js";
import type { RecentsPaneProps } from "./RecentsPane.js";
import type { StarredPaneProps } from "./StarredPane.js";
import type { UploadTrayPanelProps } from "./UploadTrayPanel.js";
import { DriveBreadcrumbBar } from "./DriveBreadcrumbBar.js";
import { DriveRowActions } from "./DriveRowActions.js";
import { DriveSearchField } from "./DriveSearchField.js";
import { DriveThumbnail } from "./DriveThumbnail.js";
import { DriveTrashPane } from "./DriveTrashPane.js";
import { RecentsPane } from "./RecentsPane.js";
import { StarredPane } from "./StarredPane.js";
import { UploadTrayPanel } from "./UploadTrayPanel.js";

/** Slot name → the component contract a replacement must satisfy. */
export interface DriveSkinSlots {
  readonly breadcrumbBar: ComponentType<DriveBreadcrumbBarProps>;
  readonly rowActions: ComponentType<DriveRowActionsProps>;
  readonly searchField: ComponentType<DriveSearchFieldProps>;
  readonly thumbnail: ComponentType<DriveThumbnailProps>;
  readonly trashPane: ComponentType<DriveTrashPaneProps>;
  readonly recentsPane: ComponentType<RecentsPaneProps>;
  readonly starredPane: ComponentType<StarredPaneProps>;
  readonly uploadTray: ComponentType<UploadTrayPanelProps>;
}

export type DriveSkinSlotName = keyof DriveSkinSlots;

const builtins: DriveSkinSlots = {
  breadcrumbBar: DriveBreadcrumbBar,
  rowActions: DriveRowActions,
  searchField: DriveSearchField,
  thumbnail: DriveThumbnail,
  trashPane: DriveTrashPane,
  recentsPane: RecentsPane,
  starredPane: StarredPane,
  uploadTray: UploadTrayPanel,
};

const registered = new Map<DriveSkinSlotName, DriveSkinSlots[DriveSkinSlotName]>();

/**
 * Register (or override) the component for a skin slot. Call at startup,
 * before the first resolve — module-global, like the docs pair's registry.
 */
export function registerDriveSkinComponent<K extends DriveSkinSlotName>(
  slot: K,
  component: DriveSkinSlots[K]
): void {
  registered.set(slot, component);
}

/** Remove an explicit registration (the builtin resolves again). */
export function unregisterDriveSkinComponent(slot: DriveSkinSlotName): void {
  registered.delete(slot);
}

/** Resolve a slot: explicit registration > builtin. Never `null` — every slot
 * ships a builtin. */
export function resolveDriveSkinComponent<K extends DriveSkinSlotName>(
  slot: K
): DriveSkinSlots[K] {
  return (registered.get(slot) as DriveSkinSlots[K] | undefined) ?? builtins[slot];
}
