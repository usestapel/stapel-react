/**
 * Wire enum → i18n key, and wire enum → status FAMILY, one table per axis.
 *
 * Every table has the same fallback shape, and the fallback is the point: all
 * three enums can gain a member in a backend minor, and a `switch` with no
 * default would render a raw wire token (`silenced`, `critical`) at an
 * operator — or, worse, fall into the wrong colour and paint a new fatal
 * green. An unrecognised value renders the "unknown ({x})" copy in the neutral
 * family, which is honest and still says exactly what the server sent.
 *
 * The families come from `@stapel/tokens-antd`'s `StatusTag` vocabulary
 * (§ the skin registry): five families for the whole fleet, so "this failed"
 * is the same red here as everywhere else a host draws a failure.
 */
import type { StatusFamily } from "@stapel/tokens-antd/skin";
import { ALERTS_I18N_KEYS } from "../i18n/keys.js";

/** Copy for a severity. */
export function levelKey(level: string): string {
  switch (level) {
    case "debug":
      return ALERTS_I18N_KEYS.levelDebug;
    case "info":
      return ALERTS_I18N_KEYS.levelInfo;
    case "warning":
      return ALERTS_I18N_KEYS.levelWarning;
    case "error":
      return ALERTS_I18N_KEYS.levelError;
    case "fatal":
      return ALERTS_I18N_KEYS.levelFatal;
    default:
      return ALERTS_I18N_KEYS.levelUnknown;
  }
}

/**
 * The status family a severity belongs to.
 *
 * `fatal` and `error` are both the error family and that is deliberate: a
 * sixth colour for "worse than red" would be a colour nobody can read faster
 * than red. What separates them is the WORD, and the feed sorts by level so
 * the fatals are already at the top of their service.
 */
export function levelFamily(level: string): StatusFamily {
  switch (level) {
    case "fatal":
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "info";
    default:
      return "neutral";
  }
}

/** Copy for where an occurrence came from. */
export function kindKey(kind: string): string {
  switch (kind) {
    case "exception":
      return ALERTS_I18N_KEYS.kindException;
    case "log":
      return ALERTS_I18N_KEYS.kindLog;
    case "dlq":
      return ALERTS_I18N_KEYS.kindDlq;
    case "monitoring":
      return ALERTS_I18N_KEYS.kindMonitoring;
    case "manual":
      return ALERTS_I18N_KEYS.kindManual;
    default:
      return ALERTS_I18N_KEYS.kindUnknown;
  }
}

/** Copy for where an issue is in its life. */
export function statusKey(status: string): string {
  switch (status) {
    case "new":
      return ALERTS_I18N_KEYS.statusNew;
    case "fixed":
      return ALERTS_I18N_KEYS.statusFixed;
    case "regressed":
      return ALERTS_I18N_KEYS.statusRegressed;
    case "muted":
      return ALERTS_I18N_KEYS.statusMuted;
    default:
      return ALERTS_I18N_KEYS.statusUnknown;
  }
}

/**
 * The status family a tracker status belongs to.
 *
 * `regressed` is the ERROR family while `new` is only a warning, and that is
 * the one judgement in this table: a bug somebody already closed and which
 * came back anyway is worse news than a bug nobody has looked at, because it
 * means a fix that was believed did not hold.
 */
export function statusFamily(status: string): StatusFamily {
  switch (status) {
    case "fixed":
      return "success";
    case "regressed":
      return "error";
    case "new":
      return "warning";
    case "muted":
      return "neutral";
    default:
      return "neutral";
  }
}
