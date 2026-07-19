/**
 * `<PhoneChangePanel/>` — thin `channel="phone"` wrapper around the shared
 * `AuthenticatorChangePanel`, mirroring how `authenticatorChangeFlow.ts`
 * itself is already channel-parametrized rather than forked per channel.
 */
import type { ReactElement } from "react";
import { AuthenticatorChangePanel } from "./AuthenticatorChangePanel.js";

export function PhoneChangePanel(): ReactElement {
  return <AuthenticatorChangePanel channel="phone" />;
}
