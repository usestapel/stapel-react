/**
 * `<Relationship/>` — default skin for the headless
 * {@link Relationship as HeadlessRelationship} control (§54: every headless
 * primitive carries a default AntD implementation; "imported → it drew
 * itself"). Follow / unfollow / block / unblock for ONE target user, with the
 * live status.
 *
 * THREE THINGS THE VISUAL PASS (2026-08-24) ASKED FOR, AND WHERE THEY ARE:
 *
 * 1. **The card must not assert two contradictory states.** The demo used to
 *    print "This is you" *below* a live Follow/Block pair. `self` is not a
 *    decoration on the buttons — it is a different screen: when the target IS
 *    the caller there are no controls at all, only the sentence.
 * 2. **Not every button is primary.** Follow is the one primary. Block is a
 *    `type="text" danger` link at the end of the row — present, findable, and
 *    visibly not the safe path — and it goes through {@link SkinConfirm}
 *    (a bottom sheet on a phone), which is where the consequence is spelled
 *    out. `danger` on the confirm focuses Cancel first and refuses a
 *    backdrop-tap dismissal.
 * 3. **A switched-off control states its reason, as text, beside it.** Follow
 *    while blocked is not "greyed out"; it says "Unblock this person before
 *    you can follow them" through `GatedButton` + `aria-describedby`. The
 *    house rule bans the tooltip alternative — a disabled antd Button fires
 *    no pointer events, so a tooltip on it is a reason nobody can read.
 *
 * The status read has three answers and they stay three: while it is in
 * flight or failed, `status` is `null` and BOTH actions are gated with a
 * reason, rather than being offered against a relationship nobody could read.
 *
 * ── TWO INVARIANTS THIS FILE MUST NOT BREAK ─────────────────────────────────
 *
 * **1. The blocked party never learns they are blocked.** `status:
 * "blocked"` is the caller's OWN stored action — *I* blocked *them*, a fact
 * the caller already knows because they did it — and
 * {@link PROFILES_I18N_KEYS.relBlockedWhileBlocked} /
 * {@link PROFILES_I18N_KEYS.relBlockedNotice} are scoped to exactly that
 * direction. There is deliberately NO arm, no copy and no gate for "somebody
 * has blocked you": the backend answers such a caller the same way it answers
 * any other unavailable relationship — same code, same shape — and this skin
 * must never re-derive the difference. Concretely: do not special-case a
 * status code from a failed follow, do not compare a 403/404 against a
 * "neutral" read, do not treat a vanished profile as a block. Any refusal
 * renders through `ErrorAlert` with the sentence the server sent, which is
 * the same sentence everyone else gets. Inferring the hidden state on the
 * client would defeat a privacy guarantee the server is paying for.
 *
 * **2. Blocking never deletes history.** Block gates FUTURE interaction; it
 * does not remove the person from a list, a thread or a count. So this
 * component performs no local removal and no optimistic list surgery: the
 * mutations invalidate the caller's own lists and whatever the server sends
 * back is what gets drawn.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { SkinConfirm, ErrorAlert, GatedButton } from "@stapel/tokens-antd/skin";
import { actionAvailable, actionBlocked, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { Relationship as HeadlessRelationship } from "../headless/Relationship.js";
import type { RelationshipBag } from "../headless/Relationship.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

export interface RelationshipProps {
  /** The target user. */
  readonly userId: string;
  /**
   * The target's display name, for the confirm copy ("Block Ada Lovelace?").
   * Omitted, the confirm falls back to the pair's `Unnamed` word rather than
   * to the id — an id must never reach the glass.
   */
  readonly displayName?: string;
  /** Compact controls for a list row (default `middle` for a page header). */
  readonly size?: "small" | "middle";
  /** Reason layout: `stack` (default) puts the reason under the control,
   * `inline` beside it. Forwarded to `GatedButton`. */
  readonly layout?: "stack" | "inline";
  /** Hide the block/unblock affordance — a roster that only offers following
   * (the block control still exists on the person's own profile page). */
  readonly showBlock?: boolean;
  readonly testId?: string;
}

/** Which confirmation, if any, is open. */
type Pending = "block" | "unblock" | null;

function RelationshipControls(props: {
  bag: RelationshipBag;
  skin: RelationshipProps;
}): ReactElement {
  const t = useT();
  const { bag } = props;
  const [pending, setPending] = useState<Pending>(null);
  const size = props.skin.size ?? "middle";
  const showBlock = props.skin.showBlock ?? true;
  const name =
    props.skin.displayName?.trim() ||
    t(PROFILES_I18N_KEYS.personUnnamed);

  // `self` is a different screen, not a disabled variant of this one.
  if (bag.status === "self") {
    return (
      <Typography.Text type="secondary" data-stapel-relationship="self">
        {t(PROFILES_I18N_KEYS.relSelf)}
      </Typography.Text>
    );
  }

  // The status read has not landed (loading, or failed). Both actions are
  // blocked WITH the reason — never offered against a relationship nobody
  // could read.
  const known = bag.status !== null;
  const followGate: ActionAvailability = !known
    ? actionBlocked(PROFILES_I18N_KEYS.relBlockedUnknown)
    : bag.isBlocked
      ? actionBlocked(PROFILES_I18N_KEYS.relBlockedWhileBlocked)
      : actionAvailable();
  const blockGate: ActionAvailability = known
    ? actionAvailable()
    : actionBlocked(PROFILES_I18N_KEYS.relBlockedUnknown);

  const testId = props.skin.testId;
  const layout = props.skin.layout ?? "stack";

  return (
    <Flex
      vertical
      gap={spacing[2]}
      data-stapel-relationship={bag.status ?? "unknown"}
      {...(testId ? { "data-testid": testId } : {})}
    >
      {/* A failed action is stated above the controls, which stay usable. */}
      <ErrorAlert
        variant="inline"
        thrown={bag.isError ? bag.error : undefined}
        testId="relationship-error"
      />

      {bag.isBlocked && (
        <Typography.Text type="secondary" data-testid="relationship-blocked-notice">
          {t(PROFILES_I18N_KEYS.relBlockedNotice)}
        </Typography.Text>
      )}

      <Flex align="center" gap={spacing[2]} wrap="wrap">
        <GatedButton
          gate={followGate}
          layout={layout}
          size={size}
          type={bag.isFollowing ? "default" : "primary"}
          loading={bag.isMutating}
          onClick={() => (bag.isFollowing ? bag.unfollow() : bag.follow())}
          testId="relationship-follow"
          data-analytics="none"
          data-analytics-reason="business action (a plain POST, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
        >
          {bag.isFollowing
            ? t(PROFILES_I18N_KEYS.relUnfollow)
            : t(PROFILES_I18N_KEYS.relFollow)}
        </GatedButton>

        {showBlock && (
          <GatedButton
            gate={blockGate}
            layout={layout}
            size={size}
            // Not a primary, and not a solid danger button either: the
            // destructive path is findable and visibly quieter than Follow.
            type="text"
            danger
            onClick={() => setPending(bag.isBlocked ? "unblock" : "block")}
            testId="relationship-block"
            data-analytics="none"
            data-analytics-reason="opens a confirmation; the write is tracked at the confirm"
          >
            {bag.isBlocked
              ? t(PROFILES_I18N_KEYS.relUnblock)
              : t(PROFILES_I18N_KEYS.relBlock)}
          </GatedButton>
        )}
      </Flex>

      <SkinConfirm
        open={pending === "block"}
        danger
        title={t(PROFILES_I18N_KEYS.relBlockConfirmTitle, { name })}
        body={t(PROFILES_I18N_KEYS.relBlockConfirmBody)}
        confirmLabel={t(PROFILES_I18N_KEYS.relBlock)}
        dismissLabel={t(PROFILES_I18N_KEYS.actionClose)}
        confirming={bag.isMutating}
        onConfirm={() => {
          bag.block();
          setPending(null);
        }}
        onCancel={() => setPending(null)}
        data-testid="relationship-confirm-block"
      />
      <SkinConfirm
        open={pending === "unblock"}
        title={t(PROFILES_I18N_KEYS.relUnblockConfirmTitle, { name })}
        body={t(PROFILES_I18N_KEYS.relUnblockConfirmBody)}
        confirmLabel={t(PROFILES_I18N_KEYS.relUnblock)}
        dismissLabel={t(PROFILES_I18N_KEYS.actionClose)}
        confirming={bag.isMutating}
        onConfirm={() => {
          bag.unblock();
          setPending(null);
        }}
        onCancel={() => setPending(null)}
        data-testid="relationship-confirm-unblock"
      />
    </Flex>
  );
}

export function Relationship(props: RelationshipProps): ReactElement {
  return (
    <HeadlessRelationship userId={props.userId}>
      {(bag) => <RelationshipControls bag={bag} skin={props} />}
    </HeadlessRelationship>
  );
}
