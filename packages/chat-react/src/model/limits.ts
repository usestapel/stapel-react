/**
 * Mirrors of the backend's CONFIGURABLE limits — axes, not constants.
 *
 * `STAPEL_CHAT.MAX_BODY_LENGTH` (`stapel_chat/conf.py`, surfaced in
 * `docs/capabilities.json`) defaults to 4000 characters and a deployment may
 * narrow it. The server stays authoritative and answers
 * `error.400.chat_body_too_long`; the mirror exists so a person is told before
 * they lose what they typed, not after. A host that changed the axis passes
 * its own value to `<MessageComposer maxLength=…>`.
 */
export const CHAT_DEFAULT_MAX_BODY_LENGTH = 4000;

/**
 * `STAPEL_CHAT["MAX_ATTACHMENTS"]` (`docs/capabilities.json`, "A message with
 * more attachments than this is rejected (400)"). Ten by default, and a
 * deployment moves it — so it is an axis a host passes down, never a constant
 * compiled into a control. The server stays authoritative; this exists so the
 * eleventh pick is refused with a sentence instead of the whole message being
 * rejected after the person pressed send.
 */
export const CHAT_DEFAULT_MAX_ATTACHMENTS = 10;
