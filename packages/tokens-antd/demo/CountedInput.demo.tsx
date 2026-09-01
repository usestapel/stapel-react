/**
 * `CountedInput` — the three frames a length limit actually has: comfortably
 * under it, exactly on it, and over it with the field still accepting text.
 *
 * The over-limit frame is the one worth photographing: it is what a
 * `maxlength` attribute would have made unreachable, by stopping the keyboard
 * instead of saying anything.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { CountedInput } from "../src/skin/countedInput.js";
import { SkinTheme } from "../src/skin/theme.js";

const PHONE_FRAME_WIDTH = 390;

const VIN_LABEL = "VIN";
const VIN_PLACEHOLDER = "17 characters, no spaces";
const VIN_ERROR = "A VIN is exactly 17 characters.";
const TITLE_LABEL = "Title";
const TITLE_PLACEHOLDER = "What are you selling?";

/** Spaces out, upper case in — what a VIN copied out of a document needs. */
function normalizeCode(text: string): string {
  return text.replace(/\s/g, "").toUpperCase();
}

function Frame(props: { readonly children: ReactElement }): ReactElement {
  return (
    <SkinTheme surface="base" style={{ padding: spacing[4], maxWidth: PHONE_FRAME_WIDTH }}>
      {props.children}
    </SkinTheme>
  );
}

function Counted(props: {
  readonly initial: string;
  readonly maxLength: number;
  readonly label: string;
  readonly placeholder: string;
  readonly mono?: boolean;
  readonly multiline?: boolean;
  readonly error?: string;
}): ReactElement {
  const [value, setValue] = useState(props.initial);
  return (
    <CountedInput
      value={value}
      onChange={setValue}
      maxLength={props.maxLength}
      ariaLabel={props.label}
      placeholder={props.placeholder}
      {...(props.mono === true ? { mono: true, normalize: normalizeCode } : {})}
      {...(props.multiline === true ? { multiline: true } : {})}
      {...(props.error !== undefined ? { status: "error" as const, errorText: props.error } : {})}
    />
  );
}

export default defineDemo({
  id: "tokens-antd.counted-input",
  title: "Counted input",
  description:
    "A length limit shown as a live counter rather than enforced as a silent cap. The DOM's `maxlength` counts UTF-16 code units while the backend counts Unicode code points, so the attribute stops somebody two emoji short of the real limit with no message at all — this component therefore never sets it, counts in the engine's own unit, and turns the counter to the error colour when the text goes past the limit. `normalize` runs where foreign text enters (the paste) and once more on blur — the last moment a fix is still invisible — never per keystroke, because a normalizer that strips spaces as you type makes two words impossible.",
  component: CountedInput,
  tokens: ["surface-raised", "border", "text-muted", "error"],
  variants: {
    under: {
      description:
        "A free-text field well inside its limit: the counter is a quiet muted line under the box, right-aligned, out of the way of the field's own help.",
      viewport: "phone",
      step: "under",
      render: () => (
        <Frame>
          <Counted
            multiline
            initial="Family estate, one owner, full service history"
            maxLength={120}
            label={TITLE_LABEL}
            placeholder={TITLE_PLACEHOLDER}
          />
        </Frame>
      ),
    },
    "mono-at-limit": {
      description:
        "A VIN at exactly its 17 characters, in the token monospace face so 0/O and 1/l can be told apart against a document. Pasting one with spaces in it normalizes on the way in.",
      viewport: "phone",
      step: "at-limit",
      render: () => (
        <Frame>
          <Counted
            mono
            initial="WBA3A5C51DF123456"
            maxLength={17}
            label={VIN_LABEL}
            placeholder={VIN_PLACEHOLDER}
          />
        </Frame>
      ),
    },
    over: {
      description:
        "Two characters past the limit: the keystrokes were accepted, the counter is red and reads 19 / 17, and the refusal is a sentence under the field. This frame does not exist at all in a `maxlength` field — the person simply finds the keyboard doing nothing.",
      viewport: "phone",
      step: "over",
      render: () => (
        <Frame>
          <Counted
            mono
            initial="WBA3A5C51DF12345678"
            maxLength={17}
            label={VIN_LABEL}
            placeholder={VIN_PLACEHOLDER}
            error={VIN_ERROR}
          />
        </Frame>
      ),
    },
  },
});
