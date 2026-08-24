/**
 * The skin's one-off geometries — the handful of widths that are genuinely a
 * control's own size rather than a step on the spacing scale.
 *
 * `@stapel/tokens`' `spacing` scale tops out at 64px, so it cannot express
 * "how wide is a state dropdown"; the doctrine's answer (`stapel/
 * no-raw-dimensions`, the `offScale` message) is a NAMED constant rather than
 * a literal buried in a style object — one place to change, and a name that
 * says which control it belongs to. Everything that IS on the scale (gaps,
 * padding, margins, font sizes) goes through `spacing` / `fontSize` instead
 * and is not repeated here.
 */

/** The builder's `draft | open | closed` selector. Sized to the longest
 * translated state label rather than to the widest of the three in English. */
export const FORM_STATE_SELECT_WIDTH = 160;

/** The responses toolbar's version filter — "All versions" plus a numeral. */
export const VERSION_SELECT_WIDTH = 192;

/** The response-detail dialog at tablet and above. Below the sheet
 * breakpoint `SkinDialog` ignores it and goes viewport-wide. */
export const RESPONSE_DIALOG_WIDTH = 480;

/** The form-settings dialog. Narrower than the response detail: it is a short
 * column of inputs, and a wide text input reads as an invitation to type a
 * paragraph into a field that holds one address. */
export const SETTINGS_DIALOG_WIDTH = 440;

/** `convertible_unit`'s unit selector, beside its number input. */
export const UNIT_SELECT_WIDTH = 96;

/** The retention override: a small integer, never a sentence. */
export const RETENTION_INPUT_WIDTH = 160;
