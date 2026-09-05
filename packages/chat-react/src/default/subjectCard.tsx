/**
 * WHAT THE CONVERSATION IS ABOUT, pinned at the top of the thread.
 *
 * ── The defect ────────────────────────────────────────────────────────────
 *
 * "Still available?" — about which of the seller's five listings? Until
 * stapel-chat 0.6.0 nothing could answer that: a direct thread was keyed by
 * the pair of people, so every listing a buyer asked about landed in the same
 * conversation with no marker of any kind. The backend half of the fix
 * shipped (an opaque `(subject_type, subject_key)`, hashed into `direct_key`,
 * resolved to a card by the type's registered `card_function`), and this is
 * the front half: the card, at the top, linking to the thing.
 *
 * ── Why a defensive reader and not a type ─────────────────────────────────
 *
 * `SubjectResponse.card` is `unknown` by contract. Chat stores a NAME and
 * asks the owner of that name for a card; it never looks inside, and neither
 * does this pair's model layer. What the skin does is read a small, DOCUMENTED
 * projection — title, price, photo, link, state — with a runtime guard on
 * every field, and render only what is really there. Those field names are
 * not invented here: they are the ones `classified.subject_cards` serves, and
 * `image` is the same CDN render descriptor this module's own
 * `AttachmentResponse` carries, so the shape is already inside chat's wire.
 *
 * A product whose card is shaped differently does not patch this file — it
 * fills `slots.subjectCard` (`model/slots.ts`) and owns the whole rendering.
 *
 * ── Degradation is data, and it is rendered ───────────────────────────────
 *
 * A subject whose listing was deleted comes back as a `gone` card rather than
 * as nothing, and a card the provider could not build comes back with a
 * `meta_reason`. Both are states a person standing in the conversation is
 * MOST confused by, so both are drawn — never an empty box, never silence.
 */
import type { CSSProperties, ReactElement } from "react";
import { Flex, Typography, theme as antdTheme } from "antd";
import { useI18n, useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens-antd";
import type { Subject } from "../api/types.js";
import { useChatRuntime } from "../model/context.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/** The conventional projection of a subject card. Every field optional. */
export interface SubjectCardView {
  readonly title: string;
  /** Formatted for the reader's locale, or `""` when there is no price. */
  readonly price: string;
  /** A photo to draw, already a URL (a CDN variant or an inline preview). */
  readonly imageUrl: string | null;
  /** Where the thing itself lives. */
  readonly href: string;
  /** `available` / `unavailable` / `gone`, or `""` when the card says nothing. */
  readonly state: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * A drawable URL out of a CDN render descriptor.
 *
 * The smallest variant at least {@link THUMB_MIN_WIDTH} wide — a thread header
 * is a thumbnail, and asking for the 1080 tier to paint 56 pixels is bytes
 * nobody sees. With no variants at all the inline `preview_b64` placeholder is
 * used, which is a real image and honestly blurry, rather than nothing.
 */
const THUMB_MIN_WIDTH = 120;

function imageUrl(image: Record<string, unknown> | null): string | null {
  if (image === null) return null;
  const variants = Array.isArray(image["variants"]) ? image["variants"] : [];
  let best: { url: string; width: number } | null = null;
  for (const raw of variants) {
    const variant = record(raw);
    if (variant === null) continue;
    const url = text(variant["url"]);
    if (url === "") continue;
    const width = typeof variant["width"] === "number" ? variant["width"] : 0;
    if (width < THUMB_MIN_WIDTH) continue;
    if (best === null || width < best.width) best = { url, width };
  }
  if (best !== null) return best.url;
  const preview = text(image["preview_b64"]);
  return preview === "" ? null : preview;
}

/**
 * Read the conventional fields off an opaque card. `null` when there is
 * nothing renderable at all — the caller then says so rather than drawing an
 * empty frame.
 */
export function readSubjectCard(
  subject: Subject,
  locale: string
): SubjectCardView | null {
  const card = record(subject.card);
  if (card === null) return null;
  const currency = text(card["currency"]);
  const rawPrice = card["price"];
  const amount =
    typeof rawPrice === "number"
      ? rawPrice
      : typeof rawPrice === "string" && rawPrice.trim() !== ""
        ? Number(rawPrice)
        : Number.NaN;
  // A price is DATA: `Intl` formats it from the reader's own locale, so it
  // needs no i18n key and cannot go stale in a catalogue. A currency the
  // deployment spells in something other than ISO-4217 must not throw the
  // header away, so the amount is formatted plainly instead.
  let price = "";
  if (Number.isFinite(amount)) {
    try {
      price = new Intl.NumberFormat(locale, {
        ...(currency.length === 3
          ? { style: "currency" as const, currency }
          : {}),
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      price = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
        amount
      );
    }
  }
  return {
    title: text(card["title"]),
    price,
    imageUrl: imageUrl(record(card["image"])),
    href: text(card["url"]),
    state: text(card["state"]),
  };
}

/** The one-line name of a subject, for an inbox row. `""` when unknown. */
export function subjectRowLabel(subject: Subject, locale: string): string {
  const view = readSubjectCard(subject, locale);
  if (view === null) return "";
  return view.title;
}

/** On the design-system scale, so a denser skin rescales with the tokens. */
const THUMB_SIZE = spacing[7];

/**
 * A thumbnail box: an `<img>` when there is a URL, a themed placeholder when
 * there is not — never a torn-page glyph, never a layout shift.
 *
 * `size` and `testId` are overridable so the same drawing rule serves both
 * the pinned card ({@link THUMB_SIZE}, `chat-subject-thumb`) and the inbox
 * row's smaller inline one ({@link ROW_THUMB_SIZE}, `chat-row-subject-thumb`)
 * without a second copy of the URL-vs-placeholder branch.
 */
function Thumb(props: {
  readonly url: string | null;
  readonly alt: string;
  readonly size?: number;
  readonly testId?: string;
}): ReactElement {
  const { token } = antdTheme.useToken();
  const size = props.size ?? THUMB_SIZE;
  const testId = props.testId ?? "chat-subject-thumb";
  const box: CSSProperties = {
    width: size,
    height: size,
    flex: "0 0 auto",
    borderRadius: radii.md,
    background: token.colorFillQuaternary,
    objectFit: "cover",
  };
  // No URL is not a broken image: the box the photo would have occupied is
  // painted from the theme's own fill, so the header never shifts when a
  // photo lands and never shows a torn-page glyph when it does not.
  return props.url === null ? (
    <div style={box} data-testid={testId} data-photo="none" />
  ) : (
    <img
      src={props.url}
      alt={props.alt}
      style={box}
      data-testid={testId}
      data-photo="present"
    />
  );
}

/** Small enough to sit inline on an inbox row, beside the counterparty avatar. */
const ROW_THUMB_SIZE = spacing[5];

/**
 * WHAT the row is about, on one line: thumbnail, title, price — or nothing
 * at all when the conversation carries no subject. Used by the default
 * inbox row (`ConversationListPanel`) in place of the old title-only
 * {@link subjectRowLabel}.
 */
export function SubjectRowSummary(props: {
  readonly subject: Subject;
  readonly locale: string;
}): ReactElement | null {
  const t = useT();
  const view = readSubjectCard(props.subject, props.locale);
  if (view === null) return null;
  if (view.title === "" && view.price === "" && view.imageUrl === null) return null;
  const label = t(CHAT_I18N_KEYS.subjectLabel);
  const alt = view.title === "" ? label : view.title;
  return (
    <Flex
      align="center"
      gap={spacing[2]}
      style={{ minWidth: 0 }}
      data-testid="chat-row-subject"
    >
      <Thumb
        url={view.imageUrl}
        alt={alt}
        size={ROW_THUMB_SIZE}
        testId="chat-row-subject-thumb"
      />
      {view.title !== "" ? (
        <Typography.Text
          ellipsis
          style={{ minWidth: 0 }}
          data-testid="chat-row-subject-title"
        >
          {view.title}
        </Typography.Text>
      ) : null}
      {view.price !== "" ? (
        <Typography.Text
          type="secondary"
          style={{ whiteSpace: "nowrap", flex: "0 0 auto" }}
          data-testid="chat-row-subject-price"
        >
          {view.price}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}

/**
 * The default subject card: photo, title, price, and a link to the thing —
 * or the sentence naming why one of those is missing.
 */
export function SubjectCard(props: {
  readonly subject: Subject;
  readonly conversationId: string;
}): ReactElement | null {
  const t = useT();
  const { locale } = useI18n();
  const { token } = antdTheme.useToken();
  const runtime = useChatRuntime();
  const Slot = runtime.slots.subjectCard;
  const { subject } = props;

  if (Slot !== undefined) {
    return (
      <Slot subject={subject} conversationId={props.conversationId} />
    ) as ReactElement;
  }

  const view = readSubjectCard(subject, locale);
  const label = t(CHAT_I18N_KEYS.subjectLabel);
  // `gone` is the state the owner actually met: a conversation about a
  // listing that no longer exists. It is drawn, with its own sentence, in
  // exactly the place the card would have been.
  const note =
    view === null
      ? t(CHAT_I18N_KEYS.subjectUnresolved)
      : view.state === "gone"
        ? t(CHAT_I18N_KEYS.subjectGone)
        : view.state === "unavailable"
          ? t(CHAT_I18N_KEYS.subjectUnavailable)
          : "";
  const title = view?.title ?? "";
  const href = view?.href ?? "";

  const body = (
    <Flex align="center" gap={spacing[3]} style={{ minWidth: 0 }}>
      <Thumb url={view?.imageUrl ?? null} alt={title === "" ? label : title} />
      <Flex vertical gap={spacing[1]} style={{ minWidth: 0 }}>
        {title !== "" ? (
          <Typography.Text strong ellipsis data-testid="chat-subject-title">
            {title}
          </Typography.Text>
        ) : null}
        {view !== null && view.price !== "" ? (
          <Typography.Text data-testid="chat-subject-price">
            {view.price}
          </Typography.Text>
        ) : null}
        {note !== "" ? (
          <Typography.Text type="secondary" data-testid="chat-subject-note">
            {note}
          </Typography.Text>
        ) : null}
      </Flex>
    </Flex>
  );

  return (
    <section
      aria-label={label}
      data-testid="chat-subject"
      data-subject-type={subject.type}
      data-subject-state={view?.state ?? ""}
      style={{
        background: token.colorFillQuaternary,
        borderRadius: radii.md,
        padding: spacing[3],
        marginBottom: spacing[3],
      }}
    >
      {href === "" ? (
        body
      ) : (
        <Typography.Link
          href={href}
          aria-label={t(CHAT_I18N_KEYS.subjectOpen)}
          data-testid="chat-subject-link"
          data-analytics="none"
          data-analytics-reason="navigation out to the subject — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          style={{ display: "block", minWidth: 0 }}
        >
          {body}
        </Typography.Link>
      )}
    </section>
  );
}
