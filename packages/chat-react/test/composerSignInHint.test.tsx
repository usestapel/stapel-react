/**
 * WHAT THE COMPOSER OWES A PERSON WHO IS NOT SIGNED IN — D-sweep §5.
 *
 * Walked anonymously on a listing page: pressing "message the seller" opened
 * the conversation (by design — the host mints a guest for exactly that
 * gesture), and the composer that came up was fully live. The textarea took
 * text, and after typing, "Send" became ENABLED. Beside it, in the same
 * thread's header, the CALL control said its piece — "Sign in to call." — and
 * the write door said nothing at all. Two controls, one screen, one of them
 * explaining itself and one silent.
 *
 * ── The two arms, and why they are not one ────────────────────────────────
 *
 * They are different facts about different people, and collapsing them would
 * make one of the two a lie:
 *
 *   ANONYMOUS — no identity at all. `POST /conversations/{id}/messages/` is
 *   `IsAuthenticated` (stapel-chat `MessageListCreateView`), so the press buys
 *   a 401 after the fact. That is a REFUSAL, and it belongs where every other
 *   refusal in this pair is: on the gate, before the click.
 *
 *   GUEST — an issued anonymous identity. Authenticated, so the send goes
 *   through; blocking it would refuse what the server accepts, and on a host
 *   that minted the guest precisely to open this thread it would strand the
 *   person in a room they were let into and cannot speak in. What is true is
 *   narrower: the account is browser-local, so the conversation they are
 *   about to start is reachable from this device and no other. That is a
 *   WARNING beside a working control, not a reason on a dead one.
 *
 * So the test that matters most here is the negative one: the guest's Send
 * still enables. A "fix" that quieted the sweep's finding by switching the
 * control off would be the worse of the two outcomes the sweep itself named.
 */
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MandateProvider,
  mandateAsking,
  mandateResolved,
  mandateUnavailable,
} from "@stapel/core";
import type { MandatePrincipal, MandateState } from "@stapel/core";
import { ConversationThreadPanel } from "../src/default/index.js";
import { CHAT_I18N_KEYS, chatI18nBundleEn } from "../src/i18n/keys.js";
import { chatI18nBundleRu } from "../src/i18n/ru.js";
import { chatI18nBundleEs } from "../src/i18n/es.js";
import { TestHarness, mockServer } from "./harness.js";
import { CONVERSATION_ID, conversation, message } from "./fixtures.js";

const ROUTES = {
  [`/chat/conversations/${CONVERSATION_ID}/`]: { body: conversation() },
  [`/chat/conversations/${CONVERSATION_ID}/messages/`]: {
    body: { results: [message(1)], next: null },
  },
};

function stateOf(
  principal: MandatePrincipal | "asking" | "unavailable"
): MandateState {
  if (principal === "asking") return mandateAsking();
  if (principal === "unavailable") return mandateUnavailable(new Error("no /me"));
  return mandateResolved(principal);
}

function renderAs(
  principal: MandatePrincipal | "asking" | "unavailable",
  children?: ReactNode
): void {
  render(
    <TestHarness server={mockServer(ROUTES)} realtime={{ socketUrl: null }}>
      <MandateProvider source={{ state: stateOf(principal) }}>
        {children ?? (
          <ConversationThreadPanel conversationId={CONVERSATION_ID} />
        )}
      </MandateProvider>
    </TestHarness>
  );
}

async function composer(): Promise<HTMLTextAreaElement> {
  return (await screen.findByTestId(
    "chat-composer-input"
  )) as HTMLTextAreaElement;
}

async function type(text: string): Promise<void> {
  const box = await composer();
  await act(async () => {
    fireEvent.change(box, { target: { value: text } });
  });
}

function send(): HTMLButtonElement {
  return screen.getByTestId("chat-composer-send") as HTMLButtonElement;
}

describe("a guest's composer", () => {
  it("still sends — the control is NOT switched off", async () => {
    renderAs("guest");
    await type("hello");
    /* THE LOAD-BEARING NEGATIVE. A guest is authenticated; the endpoint takes
       the message. Refusing it here would be this pair overruling its own
       server, and on a host that minted the guest to open this very thread it
       would be a room with no voice in it. */
    await waitFor(() => {
      expect(send().disabled).toBe(false);
    });
  });

  it("says, before the gesture, that the conversation is browser-local", async () => {
    renderAs("guest");
    const hint = await screen.findByTestId("chat-composer-sign-in");
    expect(hint.textContent).toBe(
      chatI18nBundleEn[CHAT_I18N_KEYS.composerSignIn]
    );
    /* BEFORE the gesture, and this is the difference from a refusal. A reason
       for a dead control is earned by trying it (`visibleAvailability`); a
       warning about what a LIVE control will do has to be readable while the
       decision is still open. The composer is untouched here — no typing has
       happened — and the sentence is already on screen. */
    expect((await composer()).getAttribute("data-pristine")).toBe("true");
    /* And it is a warning, not a refusal wearing one: nothing is blocked, so
       the blocked slot stays empty even after the person types. */
    await type("hello");
    expect(screen.queryByTestId("chat-composer-blocked")).toBeNull();
  });
});

describe("a visitor with no identity at all", () => {
  it("is refused BEFORE the press, not by a 401 after it", async () => {
    renderAs("anonymous");
    await type("hello");
    await waitFor(() => {
      expect(send().disabled).toBe(true);
    });
    const reason = await screen.findByTestId("chat-composer-blocked");
    expect(reason.textContent).toBe(
      chatI18nBundleEn[CHAT_I18N_KEYS.composerBlockedSignIn]
    );
  });

  it("gets the refusal INSTEAD of the warning, never both", async () => {
    renderAs("anonymous");
    /* One fact, one sentence. A control that is off with a reason does not
       also need a warning about the same thing said a second way. */
    expect(screen.queryByTestId("chat-composer-sign-in")).toBeNull();
  });
});

describe("everyone else", () => {
  it("a member is told nothing and blocked by nothing", async () => {
    renderAs("member");
    await type("hello");
    await waitFor(() => {
      expect(send().disabled).toBe(false);
    });
    expect(screen.queryByTestId("chat-composer-sign-in")).toBeNull();
  });

  it("`unavailable` keeps its composer — «we could not ask» is not «you may not»", async () => {
    /* The arm every other control in this pair takes the same way: outside a
       `<MandateProvider>`, or with one that failed, core answers
       unresolved/unavailable and a host that never wired the axis must not
       lose its composer. */
    renderAs("unavailable");
    await type("hello");
    await waitFor(() => {
      expect(send().disabled).toBe(false);
    });
    expect(screen.queryByTestId("chat-composer-sign-in")).toBeNull();
    expect(screen.queryByTestId("chat-composer-blocked")).toBeNull();
  });

  it("`asking` neither blocks nor warns — it is a fact about the network", async () => {
    renderAs("asking");
    await type("hello");
    await waitFor(() => {
      expect(send().disabled).toBe(false);
    });
    expect(screen.queryByTestId("chat-composer-sign-in")).toBeNull();
  });
});

describe("the sentence exists in every locale this pair ships", () => {
  it("en, ru and es all carry both composer keys", () => {
    /* The rule the storefront's own lint enforces on its side of the seam
       (`i18n-key-exists`): a key rendered by a component and missing from a
       catalogue is a raw key on somebody's screen. Both keys, all three
       bundles, non-empty and not the key itself. */
    for (const [name, bundle] of [
      ["en", chatI18nBundleEn],
      ["ru", chatI18nBundleRu],
      ["es", chatI18nBundleEs],
    ] as const) {
      for (const key of [
        CHAT_I18N_KEYS.composerSignIn,
        CHAT_I18N_KEYS.composerBlockedSignIn,
      ]) {
        const sentence = bundle[key];
        expect(sentence, `${name}: ${key}`).toBeTruthy();
        expect(sentence, `${name}: ${key}`).not.toBe(key);
      }
    }
  });
});
