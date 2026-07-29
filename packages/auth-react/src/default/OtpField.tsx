/**
 * `Input.OTP` that keeps its shape on a narrow screen.
 *
 * antd's OTP boxes are flex children that grow to fill the row. On a
 * desktop form the row has a fixed width so nothing stretches; inside a
 * full-bleed mobile layout the same row is as wide as the viewport, and
 * the boxes stretch horizontally while keeping their height — squares
 * become flattened rectangles (reported on 3571.meettoday.app,
 * 2026-07-29).
 *
 * The fix is not to pad the container until the boxes look right: padding
 * that centres by squeezing is a coincidence, and it breaks again at the
 * next breakpoint. Instead the field gets its natural width and the
 * BLOCK is centred, so the boxes stay square at every width and the group
 * sits in the middle of whatever form or modal contains it.
 */
import { Input } from "antd";
import type { ComponentProps, ElementRef, ForwardRefExoticComponent, RefAttributes } from "react";
import { forwardRef } from "react";

type OtpProps = ComponentProps<typeof Input.OTP>;
type OtpRef = ElementRef<typeof Input.OTP>;

export const OtpField: ForwardRefExoticComponent<
  OtpProps & RefAttributes<OtpRef>
> = forwardRef<OtpRef, OtpProps>(
  function OtpField({ style, ...rest }, ref) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          // The row must not hand its children extra width to divide up.
          width: "100%",
        }}
      >
        <Input.OTP
          ref={ref}
          // `width: auto` stops the OTP row from filling the flex line;
          // the boxes then keep the size antd gives them.
          style={{ width: "auto", ...style }}
          {...rest}
        />
      </div>
    );
  },
);
