/**
 * `Input.OTP` whose boxes stay square on a narrow screen.
 *
 * First diagnosis (0.11.0) was wrong and the fix with it: I assumed the
 * row was STRETCHING and constrained its width. `.ant-otp` is
 * `inline-flex` with no width of its own, so it never stretched — the
 * boxes were being SQUEEZED. Each inner input is a normal antd Input at
 * `width: 100%` with the default `flex-shrink: 1`, so when the row has
 * less inline space than the boxes need, flexbox takes the difference out
 * of their width while their height stays put. Square becomes rectangle
 * (reported on 3571.meettoday.app, twice).
 *
 * So the fix belongs on the boxes, not on the row. antd v6 exposes the
 * `input` slot, and each box gets:
 *
 *   aspect-ratio: 1  — width and height shrink together, so a box that
 *                      has to get smaller stays a square while doing it
 *   height: auto     — otherwise antd's fixed height fights aspect-ratio
 *                      and the ratio silently loses
 *   min-width: 0     — a flex item will not shrink past its content
 *                      width without this, which is the whole problem
 *   flex: 1 1 0      — all boxes shrink at the same rate, so the group
 *                      stays even instead of one box collapsing first
 *
 * The row is capped at the container width and centred as a BLOCK.
 * Deliberately not centred by padding the container until it looks right:
 * centring by squeezing is a coincidence that breaks at the next
 * breakpoint.
 */
import { Input } from "antd";
import type {
  ComponentProps,
  CSSProperties,
  ElementRef,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import { forwardRef } from "react";

type OtpProps = ComponentProps<typeof Input.OTP>;
type OtpRef = ElementRef<typeof Input.OTP>;

const BOX: CSSProperties = {
  aspectRatio: "1 / 1",
  height: "auto",
  minWidth: 0,
  flex: "1 1 0",
  paddingInline: 0,
  textAlign: "center",
};

/** Six boxes plus gaps still look like a code, not a banner. */
const ROW: CSSProperties = {
  maxWidth: "min(100%, 20rem)",
  width: "100%",
};

export const OtpField: ForwardRefExoticComponent<
  OtpProps & RefAttributes<OtpRef>
> = forwardRef<OtpRef, OtpProps>(function OtpField({ styles, ...rest }, ref) {
  // antd v6 accepts either an object of slot styles or a function of the
  // props. A caller that passed the function form has taken full control
  // of the slots, so we hand it through untouched rather than pretending
  // to merge into something we cannot read.
  const merged =
    typeof styles === "function"
      ? styles
      : {
          ...styles,
          root: { ...ROW, ...styles?.root },
          input: { ...BOX, ...styles?.input },
        };

  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Input.OTP ref={ref} styles={merged} {...rest} />
    </div>
  );
});
